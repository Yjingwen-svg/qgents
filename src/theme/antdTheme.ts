import { theme, type ThemeConfig } from 'antd'

/**
 * Qgents Ant Design 主题
 * 对齐现有深色 Navy + 绿色品牌色；全局通过 ConfigProvider 注入
 */
export const qgAntdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#22c55e',
    colorBgBase: '#0b1424',
    colorBgContainer: '#161b22',
    colorBgElevated: '#1c2128',
    colorBorder: '#30363d',
    colorText: '#e6edf3',
    colorTextSecondary: '#8b949e',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#161b22',
      bodyBg: '#0b1424',
      siderBg: '#161b22',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      itemHeight: 40,
      itemMarginInline: 8,
      itemBorderRadius: 8,
    },
  },
}

/** 登录页右侧表单区：保持原型图的浅色卡片 */
export const qgLoginLightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0d9b8a',
    borderRadius: 10,
  },
}
