/**
 * get bgm src url
 */
export function getBgmSrcUrl(params: {
  cdnUrl: string
  bgmName: string
}) {
  const directSource = /^(?:[a-z][a-z\d+.-]*:|\/|\.\.?\/)/i
  if (directSource.test(params.bgmName))
    return params.bgmName

  return `${params.cdnUrl.replace(/\/$/, '')}/bgms/library/${params.bgmName}.mp3`
}
