/**
 * Returns current time formatted
 * @param {!String} format Format to return back timestamp, Default: (YYYY-MM-DD hh:mm:ss)
 * @returns {String} timestamp
 */
export function getTimestamp (format: string = 'YYYY-MM-DD hh:mm:ss'): string {
  const [month, date, year] = new Date().toLocaleDateString('en-US').split('/')
  const [hour, minute, second] = new Date().toLocaleTimeString('en-US').split(/:| /)

  const keys: { [key: string]: string } = {
    YYYY: year.padStart(4, '0'),
    MM: month.padStart(2, '0'),
    DD: date.padStart(2, '0'),
    hh: hour.padStart(2, '0'),
    mm: minute.padStart(2, '0'),
    ss: second.padStart(2, '0')
  }
  let returnText = format

  for (const key in keys) {
    var regExp = new RegExp(key, 'g')
    returnText = returnText.replace(regExp, keys[key])
  }

  return returnText
}
