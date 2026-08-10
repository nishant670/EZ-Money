import { isLocalAttachmentUri, isPdfAttachment, resolveAttachmentForSave, uploadAttachment } from '@/lib/uploads';

const jsonResponse = (payload: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(typeof payload === 'string' ? payload : JSON.stringify(payload)),
  }) as unknown as Response;

const fetchMock = () => global.fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('attachment uri helpers', () => {
  it('treats device uris as local and hosted urls as remote', () => {
    expect(isLocalAttachmentUri('file:///data/user/0/cache/receipt.jpg')).toBe(true);
    expect(isLocalAttachmentUri('content://media/external/images/1')).toBe(true);
    expect(isLocalAttachmentUri('https://api.finnri.com/uploads/abc.jpg')).toBe(false);
    expect(isLocalAttachmentUri(null)).toBe(false);
  });

  it('detects pdfs regardless of query string', () => {
    expect(isPdfAttachment('https://api.finnri.com/uploads/abc.pdf')).toBe(true);
    expect(isPdfAttachment('https://api.finnri.com/uploads/abc.PDF?v=2')).toBe(true);
    expect(isPdfAttachment('https://api.finnri.com/uploads/abc.jpg')).toBe(false);
  });
});

describe('uploadAttachment', () => {
  it('posts multipart without a hand-set content-type so the boundary survives', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    const url = await uploadAttachment('token-1', 'file:///cache/receipt.jpg');

    expect(url).toBe('https://api.finnri.com/uploads/abc.jpg');
    const [, init] = fetchMock().mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    // Setting Content-Type manually drops the multipart boundary and the Go
    // server can no longer parse the body.
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain('content-type');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('throws when the server rejects the file type', async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse(
        { error: 'unsupported_file_type', fields: { file: 'attach a JPEG, PNG, HEIC, WebP image or a PDF' } },
        false,
        415
      )
    );

    await expect(uploadAttachment('token-1', 'file:///cache/notes.txt')).rejects.toThrow();
  });

  it('throws when the response omits a url instead of returning undefined', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({}));

    await expect(uploadAttachment('token-1', 'file:///cache/receipt.jpg')).rejects.toThrow();
  });
});

describe('resolveAttachmentForSave', () => {
  it('uploads a newly picked local file', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/new.jpg' }));

    await expect(resolveAttachmentForSave('token-1', 'file:///cache/receipt.jpg')).resolves.toBe(
      'https://api.finnri.com/uploads/new.jpg'
    );
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('passes an already hosted receipt through without re-uploading', async () => {
    await expect(
      resolveAttachmentForSave('token-1', 'https://api.finnri.com/uploads/existing.jpg')
    ).resolves.toBe('https://api.finnri.com/uploads/existing.jpg');
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('resolves to null when the receipt was removed', async () => {
    await expect(resolveAttachmentForSave('token-1', null)).resolves.toBeNull();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('propagates upload failures so the entry save aborts', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ error: 'file_too_large' }, false, 413));

    // The old flow swallowed this and persisted the local file:// uri instead.
    await expect(resolveAttachmentForSave('token-1', 'file:///cache/huge.jpg')).rejects.toThrow();
  });
});
