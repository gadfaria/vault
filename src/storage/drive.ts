const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class DriveError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  appProperties?: Record<string, string>
  /** RFC 3339, only present in list results */
  createdTime?: string
  /** RFC 3339, changes on every content or metadata update */
  modifiedTime?: string
}

interface FileMetadata {
  name: string
  mimeType?: string
  parents?: string[]
  appProperties?: Record<string, string>
}

const FILE_FIELDS = 'id,name,mimeType,appProperties'
const MARKDOWN_MIME = 'text/markdown'
/** Files up to this size keep the single multipart request; bigger ones (books) use a resumable upload. */
const MULTIPART_MAX_BYTES = 20 * 1024 * 1024

/** Drive answers errors as { error: { message } }; anything else is shown as it came. */
function errorMessage(body: string): string {
  try {
    return (JSON.parse(body) as { error?: { message?: string } }).error?.message || body
  } catch {
    return body
  }
}

/** Thin wrapper over the Drive v3 REST API. Only sees files this app created (drive.file scope). */
export class DriveClient {
  private readonly getToken: () => Promise<string>

  constructor(getToken: () => Promise<string>) {
    this.getToken = getToken
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(url, { ...init, headers })
    if (!res.ok) throw new DriveError(res.status, errorMessage(await res.text()))
    return res
  }

  async list(q: string, orderBy = 'createdTime'): Promise<DriveFile[]> {
    const files: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q: `${q} and trashed = false`,
        fields: `nextPageToken,files(${FILE_FIELDS},createdTime,modifiedTime)`,
        orderBy,
        pageSize: '1000',
        spaces: 'drive',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const res = await this.request(`${API}/files?${params}`)
      const body = (await res.json()) as { files: DriveFile[]; nextPageToken?: string }
      files.push(...body.files)
      pageToken = body.nextPageToken
    } while (pageToken)
    return files
  }

  async createFolder(name: string, parentId?: string, appProperties?: Record<string, string>): Promise<DriveFile> {
    const metadata: FileMetadata = {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
      appProperties,
    }
    const res = await this.request(`${API}/files?fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
    return res.json()
  }

  /** Creates a file with its metadata and content in one multipart request. */
  private async createMultipart<T extends DriveFile>(
    metadata: FileMetadata,
    contentType: string,
    content: BlobPart,
    fields = FILE_FIELDS,
  ): Promise<T> {
    const boundary = `vault-${crypto.randomUUID()}`
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ])
    const res = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=${fields}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    return res.json()
  }

  createJson(name: string, parentId: string, data: unknown, appProperties?: Record<string, string>): Promise<DriveFile> {
    const metadata: FileMetadata = { name, mimeType: 'application/json', parents: [parentId], appProperties }
    return this.createMultipart(metadata, 'application/json; charset=UTF-8', JSON.stringify(data))
  }

  createMarkdown(name: string, parentId: string, text: string, appProperties?: Record<string, string>): Promise<DriveFile> {
    const metadata: FileMetadata = { name, mimeType: MARKDOWN_MIME, parents: [parentId], appProperties }
    return this.createMultipart(metadata, `${MARKDOWN_MIME}; charset=UTF-8`, text, `${FILE_FIELDS},modifiedTime`)
  }

  /** Replaces a text file's content and returns its new modifiedTime. */
  async updateMarkdown(fileId: string, text: string): Promise<string> {
    const res = await this.request(`${UPLOAD}/files/${fileId}?uploadType=media&fields=modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': `${MARKDOWN_MIME}; charset=UTF-8` },
      body: text,
    })
    const body = (await res.json()) as { modifiedTime: string }
    return body.modifiedTime
  }

  async readText(fileId: string): Promise<string> {
    const res = await this.request(`${API}/files/${fileId}?alt=media`)
    return res.text()
  }

  async modifiedTime(fileId: string): Promise<string> {
    const res = await this.request(`${API}/files/${fileId}?fields=modifiedTime`)
    const body = (await res.json()) as { modifiedTime: string }
    return body.modifiedTime
  }

  async readJson<T>(fileId: string): Promise<T> {
    const res = await this.request(`${API}/files/${fileId}?alt=media`)
    return res.json()
  }

  /** Uploads a binary file (image, PDF…) with its metadata: one multipart request, or a resumable upload for big files. */
  async uploadFile(file: File, parentId: string, appProperties?: Record<string, string>): Promise<DriveFile & { size?: string }> {
    const mimeType = file.type || 'application/octet-stream'
    const metadata: FileMetadata = { name: file.name, mimeType, parents: [parentId], appProperties }
    if (file.size > MULTIPART_MAX_BYTES) return this.uploadResumable(file, mimeType, metadata)
    return this.createMultipart(metadata, mimeType, file, `${FILE_FIELDS},size`)
  }

  /** Starts an upload session, then sends the whole file to it in one PUT. */
  private async uploadResumable(file: File, mimeType: string, metadata: FileMetadata): Promise<DriveFile & { size?: string }> {
    const start = await this.request(`${UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS},size`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify(metadata),
    })
    const session = start.headers.get('Location')
    if (!session) throw new DriveError(0, 'Drive did not return an upload session.')
    const res = await this.request(session, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file })
    return res.json()
  }

  /** Server-side copy: nothing is downloaded. appProperties given here replace the copied ones. */
  async copy(fileId: string, name: string, parentId: string, appProperties?: Record<string, string>): Promise<DriveFile> {
    const res = await this.request(`${API}/files/${fileId}/copy?fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parents: [parentId], appProperties }),
    })
    return res.json()
  }

  async downloadBlob(fileId: string): Promise<Blob> {
    const res = await this.request(`${API}/files/${fileId}?alt=media`)
    return res.blob()
  }

  /** Moves a file to the Drive trash (recoverable for 30 days), never deletes it outright. */
  async trash(fileId: string): Promise<void> {
    await this.request(`${API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }

  async updateJson(fileId: string, data: unknown): Promise<void> {
    await this.request(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    })
  }
}
