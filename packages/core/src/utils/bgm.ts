/**
 * get bgm src url
 */
export function getBgmSrcUrl(params: {
  cdnUrl: string
  bgmName: string
}) {
  const bgmSrc = `${params.cdnUrl}/bgms/library/${params.bgmName}.mp3`
  return bgmSrc
}
