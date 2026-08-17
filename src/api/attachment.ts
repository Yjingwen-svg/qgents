import { getApiBaseUrl, request } from './client'

/** POST /projects/{projectId}/attachments 响应（§18.1） */
export interface AttachmentCredential {
  attachmentId: string
  uploadUrl: string
  method: 'PUT'
  expiresAt: string
  headers: Record<string, string>
}

/** 附件直传与下载（接口文档 §18） */
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
