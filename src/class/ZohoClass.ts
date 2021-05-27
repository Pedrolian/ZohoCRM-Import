import { QueueClass } from './QueueClass'
import { chunks } from '../utility/chunks'
import { keyBy } from '../utility/keyBy'
import { logger } from '../utility/logger'
import { ZohoError } from './ZohoError'

interface returnArrayInPromise {
  module: string,
  id: string,
  sentData: object,
  zohoResponse: object,
}

interface returnPromise {
    success: returnArrayInPromise[],
    fail: returnArrayInPromise[]
}

interface returnCallback {
  ( error: ZohoError | null, job: any, success: returnArrayInPromise[], fail: returnArrayInPromise[] ): void;
}

export class ZohoClass {
  QueueClass: any
  stackPoolSize: number

  /**
   * Initiate ZohoClass
   * @param stackPoolSize Max number of requests allowed to be made at once
   */
  constructor (stackPoolSize: number = 5) {
    logger.log('info', `[ZohoClass]: Stack Pool Size set to ${stackPoolSize}`)
    this.stackPoolSize = stackPoolSize;
    this.QueueClass = new QueueClass(stackPoolSize)
  }

  /**
   * Add to Queue to have it make request to Zoho's API
   * @param {!String} apiMethod ZohoSDK Method to use
   * @param {!String} requestMethod ZohoCRM's Module API Name
   * @param {!Object} sentData Object for Queue connections to
   * @returns {Promise} Promise
   */
  async addToQueue (apiMethod: string, requestMethod: string, sentData: object): Promise<any> {
    return await new Promise((resolve, reject) => {
      this.QueueClass.addJob(apiMethod, requestMethod, sentData, (apiResponse: { job: object, apiResponse: object }) => {
        resolve(apiResponse)
      })
    })
  }

  /**
   * Get specified records by Ids
   * @param {!String} moduleName ZohoCRM's API Module Name
   * @param {![String]} sentData Ids to lookup
   * @param {Object} options Options to send along with request
   * @param {returnCallback} sentCallBack Callback Function
   * @returns {returnPromise} Promise
   */
  async getId (moduleName: string, sentData: string | string[], options?: { params?: { approved?: string } }, sentCallBack?: returnCallback): Promise<returnPromise> {
    // Convert input if it's string to an array
    let sentDataArray: string[] = []
    if (!Array.isArray(sentData)) {
      sentDataArray.push(sentData)
    } else {
      sentDataArray = sentData
    }

    // Breakdown array into chunk sizes to be processed
    const MAX_CHUNK_SIZE = 200
    const dataChunk = chunks(sentDataArray, MAX_CHUNK_SIZE)
    return await new Promise((resolve, reject) => {
      // Queue up all the chunks, and resolve once all of them have returned back
      let processedTally = 0

      // Return array of everything that was found
      let resolveSuccessArray: returnArrayInPromise[] = []
      let resolveFailArray: returnArrayInPromise[] = []

      for (let chunkId = 0; chunkId < dataChunk.length; chunkId++) {
        logger.log('verbose', `[getId]: ${dataChunk[chunkId].join(',')}`)
        this.addToQueue('MODULES', 'get', { module: moduleName, id: dataChunk[chunkId], ...options })
          .then(response => {
            processedTally += 1

            const { job, apiResponse } = response
            const { statusCode, body: apiBody } = apiResponse

            /**
             * statusCode
             * 200 -> Returned some data
             * 204 -> No data found
             * xxx -> All others, failed for another reason
             */
            if (statusCode === 200) {
              // console.log([job.sentData.id.length, JSON.parse(apiBody).info.count])
              const bodyData = JSON.parse(apiBody).data
              const records = keyBy(bodyData, 'id')

              // Find out which records were NOT found
              const recordsNotFound = job.sentData.id.filter((recordId: any): boolean => !Object.prototype.hasOwnProperty.call(records, recordId))
              if (recordsNotFound.length > 0) {
                logger.log('verbose', `[getId]: No records found for Ids: ${recordsNotFound.join(',')}`)
              }

              const reponseSuccessArray: returnArrayInPromise[] = bodyData.map((item: any) => {
                const formatted = { module: job.sentData.module, id: item.id, sentData: job.sentData, zohoResponse: item }
                resolveSuccessArray.push(formatted)
                return formatted;
              })

              const responseFailArray: returnArrayInPromise[] = recordsNotFound.map((item: any) => {
                const formatted = { module: job.sentData.module, id: item, sentData: job.sentData, zohoResponse: item }
                resolveFailArray.push(formatted)
                return formatted;
              })

              // Callback records found and Ids unsuccessful
              if (sentCallBack !== undefined) {
                sentCallBack(null, job.sentData, reponseSuccessArray, responseFailArray)
              }

            } else if (statusCode === 204) {
              // None of the supplied Ids matched a record
              logger.log('verbose', `[getId]: No records found for Ids: ${job.sentData.id.join(',')}`)

              const responseFailArray: returnArrayInPromise[] = job.sentData.map((item: any) => {
                const formatted = { module: job.sentData.module, id: item.id, sentData: job.sentData, zohoResponse: item }
                resolveFailArray.push(formatted)
                return formatted;
              })

              // Callback records unsuccessful
              if (sentCallBack !== undefined) {
                sentCallBack(null, job.sentData, [], responseFailArray)
              }

            } else {
              logger.log('error', apiBody)
              // Failed for some other reason
              if (sentCallBack !== undefined) {
                sentCallBack(new ZohoError(apiBody), job.sentData,  [], job.sentData.map((item: any) => {
                  return { module: job.sentData.module, id: item.id, sentData: job.sentData, zohoResponse: item }
                }))
              }
            }

            if (processedTally >= dataChunk.length) {
              resolve({ success: resolveSuccessArray, fail: resolveFailArray })
            }
          })
          .catch(e => {
            // TODO: Handle this better.
            console.log(e)
          })
      }
    })
  }

  /**
   * Get records from specified module
   * @param {!String} moduleName ZohoCRM's API Module Name
   * @param {Object} options Options to send along with request
   * @param {returnCallback} sentCallBack Callback Function
   * @returns {returnPromise} Promise
   */
  async getRecords (moduleName: string, options?: { params?: { page: number, per_page: number }, chunk?: number, headers?: object }, sentCallBack?: returnCallback): Promise<returnPromise> {
    // Configure options to send to API
    if (options === undefined) {
      options = {
        params: { page: 1, per_page: 200 },
        chunk: 1,
        headers: {}
      }
    }

    const requestOptions: { params: { page: number, per_page: number }, chunk: number, headers: object } = {
      params: (options.params !== undefined) ? options.params : { page: 1, per_page: 200 },
      chunk: (options.chunk !== undefined) ? options.chunk : 1,
      headers: (options.headers !== undefined) ? options.headers : {}
    }

    // Tracker to know if current page that's about to be looked up a lower one has already yielded no results.
    let lastPageNoResult: number = 0
    const makeRequest = (moduleName: string, options: { params: { page: number, per_page: number }, chunk: number, headers: object }, cb: Function): void => {

      // Is current page trying to request lower than last logged page with no result?
      if (lastPageNoResult >= options.params.page) {
        logger.log('verbose', `[getRecords]: ${moduleName} - page: ${options.params.page} already logged as no result.`)
        return cb(false, [], { module: moduleName, ...options }, false)
      }

      logger.log('verbose', `[getRecords]: ${moduleName} - page: ${options.params.page} - per: ${options.params.per_page}`)
      this.addToQueue('MODULES', 'get', { module: moduleName, ...options })
        .then(response => {
          const { job, apiResponse } = response
          const { statusCode, body: apiBody } = apiResponse

          /**
           * statusCode
           * 200 -> Returned some data
           * 204 -> No data found
           * xxx -> All others, failed for another reason
           */
          if (statusCode === 200) {
            const bodyJSON = JSON.parse(apiBody)
            const { info: bodyInfo, data: bodyData } = bodyJSON
            cb(false, bodyData, { module: moduleName, ...options }, bodyInfo.more_records)
            if (bodyInfo.more_records) {
              // More pages found, get current page process + add chunk size to it
              return makeRequest(job.sentData.module, { ...job.sentData, ...{ params: { ...job.sentData.params, page: bodyInfo.page + job.sentData.chunk } } }, cb)
            }
          } else if (statusCode === 204 || statusCode === 304 || statusCode === 404) {
            // None of the supplied Ids matched a record
            logger.log('verbose', `[getRecords]: No records found on ${moduleName} - page: ${options.params.page} - per: ${options.params.per_page}`)
            // Do we log this page as last one that didn't have a record?
            if (lastPageNoResult > job.sentData.params.page) {
              lastPageNoResult = job.sentData.params.page
            }
            return cb(false, [], { module: moduleName, ...options }, false)
          } else {
            logger.log('error', `[getRecords]: error retrieving data - status code: ${statusCode}.`)
            return cb(true, [], { module: moduleName, ...options }, false)
          }

        })
      return
    }

    return await new Promise((resolve, reject) => {

      // Build the initial requests by the allowed amount of chunks
      const requests = []
      for (let i = 0; i < requestOptions.chunk; i++) {
        requests.push({ ...requestOptions, ...{ params: { ...requestOptions.params, page: requestOptions.params.page + i } } })
      }

      // Return array of everything that was found
      let resolveSuccessArray: returnArrayInPromise[] = []

      /**
      * Keep track of how many requests sent and of max
      * For every request done increase requestsCounter
      * For every SUCCESSFUL request increase requestsMaxCounter
      * When both counters match that means every request has returned and there are no more to be processed
      * Only then resolve the promise.
      */
      let requestsCounter: number = 0
      let requestsMaxCounter: number = requests.length

      for (const apiRequest of requests) {
        makeRequest(moduleName, apiRequest, (error: boolean, response: object[], sentData: { module: string, chunk: number, params?: object, headers?: object }, moreRecords: boolean) => {

          requestsCounter += 1
          if (moreRecords) {
            requestsMaxCounter += 1
          }

          const reponseSuccessArray: returnArrayInPromise[] = response.map((item: any) => {
            const formatted = { module: sentData.module, id: item.id, sentData: sentData, zohoResponse: item }
            resolveSuccessArray.push(formatted)
            return formatted;
          })

          if(sentCallBack !== undefined) {
            sentCallBack(null, sentData, reponseSuccessArray, [])
          }

          if (requestsCounter === requestsMaxCounter) {
            resolve({ success: resolveSuccessArray, fail: [] })
          }
        })
      }

    })
  }

  async searchRecords (moduleName: string, options: { params: { criteria: string, page?: number, per_page?: number }, chunk?: number, headers?: object }, sentCallBack?: returnCallback): Promise<returnPromise> {

    const criteria = options.params.criteria;
    const CRITERIA_MAX_LIMIT = 10;

    return new Promise((resolve, reject) => {

      // Validate Criteria if it's the right syntax and if there's no more than 10 in it.
      const criteriaMatches = criteria.match(/\(([A-Z0-9_.\-:@$ ]+):([A-Z0-9_.\-:@$ ]+):([A-Z0-9_.\-:@$ ]+)\)/gim);
      if(criteriaMatches === null) reject(new ZohoError('Criteria is invalid, no matches found.'));
      else if(criteriaMatches.length > CRITERIA_MAX_LIMIT) reject(new ZohoError(`Criteria exceeded maximum limit of ${CRITERIA_MAX_LIMIT}.`));


      resolve({
        fail: [],
        success: []
      });
    })
  }

  async createCriteria (sentData: object | object[], criteria: string) {
    return new Promise(async (resolve, reject) => {
      const data: { [key: string]: any }[] = Array.isArray(sentData) ? sentData : [sentData];
      const searchCriteriaMatches = criteria.match(/\(([A-Z0-9_.\-:@$ ]+):([A-Z0-9_.\-:@$ ]+):([A-Z0-9_.\-:@$ ]+)\)/gim);
      if(searchCriteriaMatches === null || searchCriteriaMatches.length === 0) reject(new ZohoError('Criteria is invalid, no matches found.'));
      else {
        const chunkSize = data.length * searchCriteriaMatches.length < 10 ? (this.stackPoolSize < 10 && this.stackPoolSize !== 1 ? this.stackPoolSize : 10) : (10 / searchCriteriaMatches.length) >> 0;

        const replaceString = (data: { [key: string]: any }, str: string) => {
          let tmpStr = str;
          const strMatches = str.match(/\$(\w+)/g);
          if (strMatches != null) {
            for(const matchId in strMatches)  {
              const keyReplaced: string = strMatches[matchId].replace('$_', '');
              if(Object.prototype.hasOwnProperty.call(data, keyReplaced)) tmpStr = tmpStr.replace(strMatches[matchId], data[keyReplaced]);
            }
          }
          return tmpStr;
        }

        // Replace $_xxx matches with properties in objects[]
        const searchArray = await data.map(row => replaceString(row, criteria));

        // Break big array into max allowed sizes of criteria chunks and resolve out
        resolve(chunks(searchArray, chunkSize))
      }
    })
  }

  /**
   * Update records from specified module
   * @param {!String} moduleName ZohoCRM's API Module Name
   * @param {!Object | ![Object]} sentData Data to update ZohoCRM with
   * @param {returnCallback} sentCallBack Callback Function
   * @returns {returnCallback} Promise
   */
  async updateRecords (moduleName: string, sentData: object | object[], sentCallBack?: returnCallback): Promise<returnPromise> {
    // Convert input if it's string to an array
    let sentDataArray: object[] = []
    if (!Array.isArray(sentData)) {
      sentDataArray.push(sentData)
    } else {
      sentDataArray = sentData
    }

    // Breakdown array into chunk sizes to be processed
    const MAX_CHUNK_SIZE = 100
    const dataChunk = chunks(sentDataArray, MAX_CHUNK_SIZE)

    return new Promise((resolve, reject) => {
      // Queue up all the chunks, and resolve once all of them have returned back
      let processedTally = 0

      // Return array of everything that was found
      let resolveSuccessArray: returnArrayInPromise[] = []
      let resolveFailArray: returnArrayInPromise[] = []

      for (let chunkId = 0; chunkId < dataChunk.length; chunkId++) {
        logger.log('verbose', `[updateRecords]: Updating ${chunkId} / ${dataChunk.length}`)
        this.addToQueue('MODULES', 'put', { module: moduleName, body: { data: dataChunk[chunkId] } })
          .then(response => {
            const { job, apiResponse } = response
            const jobSentData = job.sentData.body.data;

            const { statusCode, body: apiBody } = apiResponse

            processedTally += 1;

            /**
             * statusCode
             * 200 -> Updated records
             * 202 -> Updated some records (either failure on Id or field)
             * 400 -> Invalid modulle
             * xxx -> All others, failed for another reason
             */
            // TODO: I believe there's a bug with the cb return and resolve, both are returning resolveSuccessArray ?
            console.log({jobSentData})
              if(statusCode === 200 || statusCode === 202) {
                const bodyJSON = JSON.parse(apiBody)
                const { data: bodyData } = bodyJSON

                for(const recordId in bodyData) {
                  if(bodyData[recordId].status === 'success') resolveSuccessArray.push({ module: job.sentData.module, id: jobSentData[recordId].id, sentData: jobSentData[recordId], zohoResponse: bodyData[recordId] })
                  else resolveFailArray.push({ module: job.sentData.module, id: jobSentData[recordId].id, sentData: jobSentData[recordId], zohoResponse: bodyData[recordId] })
                }

                if (sentCallBack !== undefined) sentCallBack(null, { module: job.sentData.module, data: jobSentData }, resolveSuccessArray, resolveFailArray)
              } else {
                if (sentCallBack !== undefined) sentCallBack(new ZohoError(apiBody), { module: job.sentData.module, data: jobSentData }, [], jobSentData)
              }

              // Did all process run?
              if (processedTally >= dataChunk.length) resolve({ success: resolveSuccessArray, fail: resolveFailArray })
          })
      }

    })
  }


}
