import { logger } from '../utility/logger'

declare module '@pedrolian/zcrmsdk'
import * as ZCRMRestClient from '@pedrolian/zcrmsdk'

interface Job {
  apiMethod: string
  requestMethod: string
  sentData: SentData
  cb: Function
}

interface SentData {
  module: string
  data?: any[]
  id?: any[]
}

export class QueueClass {
  poolSize: number

  queuedJobs: Job[]
  runningJobs: number

  /**
   * Initiate Queue to make requests to ZohoCRM's API
   * @param poolSize Max number of requests allowed to be made at once
   */
  constructor (poolSize: number) {
    this.poolSize = poolSize

    this.runningJobs = 0
    this.queuedJobs = []
  }

  /**
   * Add Job to Queue to fetch data from ZohoCRM
   * @param apiMethod ZohoCRM's SDK Functional API Method
   * @param requestMethod HTTP Request Method
   * @param sentData Data to send to request
   * @param sentCallBack Callback function
   * @param cb Private CB Function
   * @return void
   */
  addJob (apiMethod: string, requestMethod: string, sentData: SentData, cb: Function): void {
    logger.debug(`[Queue]: Added job: api: ${apiMethod} - type: ${requestMethod} - module: ${sentData.module}`)
    this.queuedJobs.push({ apiMethod, requestMethod, sentData, cb })
    this.processJob()
  }

  /**
   * Process first available job in queue
   * @returns void
   */
  processJob (): void {
    // Check if running jobs >= max allowed of jobs to run (poolSize)
    logger.debug(`[Queue]: Queued: ${this.queuedJobs.length} - Running: ${this.runningJobs} - Limit: ${this.poolSize}`)
    if (this.runningJobs >= this.poolSize) return

    // Are there any jobs to do?
    const job = this.queuedJobs.shift()
    if (job === undefined) return
    this.runningJobs += 1

    logger.debug(`[Queue]: Running job: api: ${job.apiMethod} - type: ${job.requestMethod} - module: ${job.sentData.module}`)
    logger.silly(`[Queue]: Processing: ${JSON.stringify(job.sentData)}`)

    ZCRMRestClient.API[job.apiMethod][job.requestMethod](job.sentData).then((apiResponse: any) => {
      logger.silly(`[Queue]: Finished: ${JSON.stringify(job.sentData)}`)
      job.cb({
        job: { ...job },
        apiResponse: { ...apiResponse }
      })

      this.runningJobs -= 1
      this.processJob()
    })
  }
}
