/**
 * 语音合成
 * @param text
 * @param lang
 */
export function speak(text: string, lang: string): void {
  const speechInstance = new SpeechSynthesisUtterance(text)
  speechInstance.lang = lang
  speechSynthesis.speak(speechInstance)
}
