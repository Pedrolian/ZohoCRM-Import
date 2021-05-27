require('dotenv').config({ path: './.env' })
import { loggerSetPath, logger } from './utility/logger'
import { ZohoClass } from './class/ZohoClass'

loggerSetPath('./log')
logger.log('info', 'ZohoCRM-Import initiated.')

const zoho = new ZohoClass()


/* // Get Id
zoho.getId('ImportacaoTeste', ['116652000057983299','116652000057980000'], { params: { approved: 'both' } },
  (error, job, success, fail) => {
    // console.log({getId: job})
    //console.log({ error, success: success.length, fail: fail.length })
    console.log(success)
    console.log(fail)
  })
  .then(({ success, fail }): void => {
    // console.log("get id: ")
    console.log({ success1: success })
    console.log({ fail1: fail[0] })
  }) */


/*
// Get records - modified since
zoho.getRecords('ImportacaoTeste', { chunk: 10, params: { page: 1, per_page: 200 }, headers: { 'If-Modified-Since': '2021-03-04T00:30:00-03:00' } })
  .then(() => {
    console.log('done...')
  })
  .catch(e => {
    console.log(e)
  })
 */

/*
// Get records - no modified
  zoho.getRecords('ImportacaoTeste', { chunk: 1, params: { page: 168, per_page: 200 } }, (error, job, success, fail) => {
    // console.log({ getrecords: job })
    //console.log({ error, success, fail })
    console.log(success[0])
  })
  .then(({ success, fail }) => {
    console.log("get Records: ")
    console.log({ success: success[0] })
  })
 */
/*
  // Update Record
  zoho.updateRecords('ImportacaoTeste', [{ id: '116652000057983299', C_digo_INEP: '111' }, { id: '116652000058774210', C_digo_INEP: 11111 }],
  (error, job, success, fail) => {
    // console.log({ updateRecords: job })
    // console.log({error, success, fail})
    console.log(fail[0])
    console.log(success[0])
  })
    .then(({ success, fail }) => {
      // console.log("update id: ")
      // console.log({ success: success })
    })
 */

    zoho.createCriteria([{ id: 'aaa' }, { id: 'bbb' },{ id: 'ccc' },
    { id: 'ddd' }, { id: 'eee' },{ id: 'fff' },
    { id: 'ggg' }, { id: 'hhh' },{ id: 'iii' },
    { id: 'jjj' }, { id: 'kkk' },{ id: 'lll' },
    { id: 'mmm' }, { id: 'nnnn' },{ id: 'oooo' }], '(id:equals:$_id)OR(1:equals:1)').then(criteria =>  console.log({criteria}))
/*
    // Search Records
    zoho.searchRecords('ImportacaoTeste', { params: { criteria: '((aaa:equals:bbb)OR(aaa:equals:ccc))' }})
      .then(({ success, fail }) => {
        console.log('donee');
      })
 */
