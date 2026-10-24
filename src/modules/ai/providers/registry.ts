import type { ProviderName } from '../domain/types'

export type ProviderConfig = {
  name: ProviderName
  label: string
  baseUrl: string
  key?: string
  model: string
}

const configs: Record<ProviderName, () => ProviderConfig> = {
  deepseek: () => ({
    name: 'deepseek',
    label: 'DeepSeek',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    key: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  }),
  stepfun: () => ({
    name: 'stepfun',
    label: '阶跃星辰',
    baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/v1',
    key: process.env.STEPFUN_API_KEY,
    model: process.env.STEPFUN_MODEL || 'step-3.5-flash',
  }),
}

export const getProviderConfig = (provider: ProviderName) => configs[provider]()

export function getProviderAvailability() {
  return {
    enabled: process.env.AI_TEXT_ENABLED === 'true',
    providers: {
      deepseek: Boolean(configs.deepseek().key),
      stepfun: Boolean(configs.stepfun().key),
    },
  }
}
