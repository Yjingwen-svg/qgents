import { JSEncrypt } from 'jsencrypt'

/**
 * RSA 公钥配置 —— 对齐接口文档 v1.1.4 §4.1
 *
 * 当前演示环境没有可用域名，公钥不再通过接口动态拉取，
 * 而是硬编码在前端代码中（也可通过构建环境变量注入）。
 */

/** RSA 公钥 keyId —— 与后端私钥配对 */
export const RSA_KEY_ID = 'rsa-2026-08'

/** RSA 加密算法 */
export const RSA_ALGORITHM = 'RSA/ECB/PKCS1Padding'

/** 平台固定 RSA 公钥（PEM 格式） */
export const RSA_PUBLIC_KEY_PEM = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAttIDG9u/Ag+1odUe5brC+54CFdFfHrjuC15piR73qx2tOquiRboE
UB2Zsq681ABEtaUS2bk1ihjm2kjoHOCwAZgXM2WSS+pAl5yTcfpGY33mpqQGKwgD
erUEhMgEReXD6JSoGRR3vV6CDVmrGbrw4Jhvjbi3WW3bKsEtFtwtF79wbHOp5Huz
IIMY7l7yRljUF7wl1Hnwsc+VfYPnd1KNT0pR7b4z8xOHM7F6rq/jQ1ByEsA4Stnt
x8WJE67C4seMyTOxY5EbVriR4x0lstULjzw8Qkuqu4fOAbVn4+JpfH9CjqvBNecH
Pwyg+E3scliNZYXywo7eMWS1RjkHPcXnnwIDAQAB
-----END RSA PUBLIC KEY-----`

/**
 * 使用 RSA 公钥加密密码。
 *
 * TODO[加密]: 当前 mock 阶段直接返回明文。
 * 正式环境可引入 jsencrypt 或用 Web Crypto API (SubtleCrypto) 实现，
 * 调用示例：
 *   const jsEncrypt = new JSEncrypt()
 *   jsEncrypt.setPublicKey(RSA_PUBLIC_KEY_PEM)
 *   return jsEncrypt.encrypt(plainPassword)  // 返回 Base64 密文
 */
export async function encryptPassword(plainPassword: string): Promise<string> {
  // TODO: 正式环境实现 RSA 加密
  // mock 阶段直传明文（MSW 不校验加密），后端联调前必须实现
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return plainPassword
  }

  const jsEncrypt = new JSEncrypt()
  jsEncrypt.setPublicKey(RSA_PUBLIC_KEY_PEM)
  const encrypted = jsEncrypt.encrypt(plainPassword)
  if (!encrypted) {
    throw new Error('密码 RSA 加密失败')
  }
  return encrypted
}
