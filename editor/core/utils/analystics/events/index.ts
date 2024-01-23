// https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api#add-custom-events
export * from './constants'

/**
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api#add-custom-events
 */
export function addCustomEvent(eventName: string) {
  if (window.clarity)
    window.clarity('event', eventName)
}

/**
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api#add-custom-tags
 */
export function addCustomTag(key: string, value: string | string[]) {
  if (window.clarity)
    window.clarity('set', key, value)
}
