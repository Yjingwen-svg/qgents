import { getApiBaseUrl, request } from './client'

/** POST /projects/{projectId}/attachments 响应（§18.1） */
export interface AttachmentCredential {
  attachmentId: string
  uploadUrl: string
  method: 'PUT'
  expiresAt: string
  headers: Record<string, string>
}

/** 附件预览类型（增量契约 §2.1，服务端判定） */
export type AttachmentPreviewType = 'IMAGE' | 'PDF' | 'TEXT' | 'CODE' | 'UNSUPPORTED'

/** GET .../attachments/{attachmentId}/preview-url 响应（增量契约 §4.1） */
export interface AttachmentPreview {
  attachmentId: string
  fileName: string
  mediaType: string | null
  sizeBytes: number | null
  previewable: boolean
  previewType: AttachmentPreviewType
  /** 相对路径，带短期 token 查询参数；前端拼 ORIGIN 使用，有效期见 expiresAt */
  previewUrl: string
  /** 下载地址（attachment 语义）；本地回退时可能 501 */
  downloadUrl: string | null
  expiresAt: string
}

/** 附件直传与下载（接口文档 §18）+ 内联预览（增量契约：附件预览与多模态输入） */
export const attachmentApi = {
  /** 创建对象存储直传凭证（§18.1） */
  createCredential(
    projectId: string,
    input: { fileName: string; contentType?: string; sizeBytes: number },
  ) {
    return request<AttachmentCredential>(`/projects/${projectId}/attachments`, {
      method: 'POST',
      body: input,
    })
  },

  /** 确认上传完成，服务端校验对象存在后置 READY（§18.2） */
  confirm(projectId: string, attachmentId: string) {
    return request<{ attachmentId: string; status: string }>(
      `/projects/${projectId}/attachments/${attachmentId}/confirm`,
      { method: 'POST' },
    )
  },

  /** 稳定展示地址（§18.5 鉴权下载代理）：消息 content.url 直接填此值 */
  contentUrl(projectId: string, attachmentId: string): string {
    return `${getApiBaseUrl()}/projects/${projectId}/attachments/${attachmentId}/content`
  },

  /** 临时下载地址（§18.3 预签名 GET，900 秒有效，无需 Bearer 即可打开） */
  getDownloadUrl(projectId: string, attachmentId: string) {
    return request<{ attachmentId: string; downloadUrl: string; expiresAt: string }>(
      `/projects/${projectId}/attachments/${attachmentId}/download-url`,
    )
  },

  /**
   * 获取附件预览元数据 + 签名预览 URL（增量契约 §4）。
   * 响应 previewUrl 为相对路径（带短期 token），前端拼 ORIGIN 后直接交给 <img>/iframe/新标签。
   * 错误：403 FORBIDDEN / 404 ATTACHMENT_NOT_FOUND / 409 ATTACHMENT_NOT_READY /
   *       501 ATTACHMENT_DOWNLOAD_UNSUPPORTED（本地回退，previewUrl 仍可用）。
   */
  previewUrl(projectId: string, attachmentId: string) {
    return request<AttachmentPreview>(
      `/projects/${projectId}/attachments/${attachmentId}/preview-url`,
    )
  },
}

/**
 * 把后端返回的相对 previewUrl 拼成可直接打开的绝对地址（增量契约 §4.1）。
 * 不用 window.location.origin：后端 previewUrl 自带 `/api/v1` 前缀，走 dev vite 代理
 * 会把 `/api` rewrite 成 `/api/v1` 导致 `/api/v1/api/v1/...` 双前缀 404。
 * 改为取 API base 的 origin 拼接（dev 直连 localhost:8080、生产直连 api.qgents...），
 * 与 contentUrl 的构造语义一致，dev/生产都能直接访问预览端点。
 */
export function resolvePreviewUrl(previewUrl: string): string {
  if (/^https?:\/\//i.test(previewUrl)) return previewUrl
  const base = getApiBaseUrl()
  const origin = /^https?:\/\//i.test(base) ? new URL(base).origin : window.location.origin
  return `${origin}${previewUrl.startsWith('/') ? previewUrl : `/${previewUrl}`}`
}

/**
 * 上传附件并返回 attachmentId：创建凭证 → 直传 OSS → 确认。
 * 失败时抛错，由调用方 toast 展示。
 */
export async function uploadAttachment(projectId: string, file: File): Promise<string> {
  const credential = await attachmentApi.createCredential(projectId, {
    fileName: file.name,
    contentType: file.type || undefined,
    sizeBytes: file.size,
  })

  // 用 ArrayBuffer 作 body：fetch 不会自动带 Content-Type 头。
  // 后端签预签名 URL 时 Content-Type 为空（§18.1 headers: {}），若带 Content-Type 会导致 SignatureDoesNotMatch(403)。
  const putRes = await fetch(credential.uploadUrl, {
    method: 'PUT',
    body: await file.arrayBuffer(),
  })
  if (!putRes.ok) {
    throw new Error(`附件上传失败（${putRes.status}）`)
  }

  await attachmentApi.confirm(projectId, credential.attachmentId)
  return credential.attachmentId
}
