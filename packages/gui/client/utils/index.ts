import pkg from '../../package.json'

export function createAGUI() {}

/**
 * 控制台输出信息
 * @param name 名称
 * @param link 链接
 * @param color 颜色
 * @param emoji
 */
function consoleInfo(
  name: string,
  link: string,
  color = '#0078E7',
  emoji = '☁️',
) {
  // eslint-disable-next-line no-console
  console.log(
    `%c ${emoji} ${name} %c${link}`,
    `color: white; background: ${color}; padding:5px 0;`,
    `padding:4px 6px;border:1px solid ${color};`,
  )
}

export function statement() {
  consoleInfo(`ADV.JS GUI v${pkg.version}`, pkg.repository.url, 'black', '🎨')
}
