import { File } from 'expo-file-system';
import { isLocalAttachmentUri, isPdfAttachment, resolveAttachmentForSave, uploadAttachment } from '@/lib/uploads';

const fileSystem = require('expo-file-system') as {
  __setFileSize: (uri: string, size: number) => void;
  __deletedFiles: string[];
  __resetFiles: () => void;
};

const manipulator = require('expo-image-manipulator') as {
  __manipulatorState: {
    source: { width: number; height: number };
    output: { uri: string; width: number; height: number };
    resizes: { width?: number | null; height?: number | null }[];
    saveOptions: { compress?: number; format?: string } | null;
    failNext: boolean;
  };
  __resetManipulator: () => void;
};

/** A photographed bill straight off the camera. */
const CAMERA_PHOTO = 'file:///cache/receipt.jpg';
const CAMERA_PHOTO_BYTES = 3.5 * 1024 * 1024;
const COMPRESSED_URI = 'file:///cache/manipulated.jpg';

/**
 * Jest's DOM `FormData` stringifies anything that is not a real `Blob`, so the
 * body itself cannot be read back to see what was appended. The append call is
 * recorded instead — that value is exactly what Expo's fetch would be handed.
 */
const appendedParts: [string, unknown][] = [];

const uploadedPart = () =>
  (appendedParts.find(([field]) => field === 'file')?.[1] ?? null) as File | null;

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
  appendedParts.length = 0;
  jest
    .spyOn(FormData.prototype, 'append')
    .mockImplementation(function (this: FormData, field: string, value: unknown) {
      appendedParts.push([field, value]);
    } as typeof FormData.prototype.append);
  fileSystem.__resetFiles();
  manipulator.__resetManipulator();
  // Big enough that every test that does not say otherwise takes the
  // compression path — that is the case the user actually hits.
  fileSystem.__setFileSize(CAMERA_PHOTO, CAMERA_PHOTO_BYTES);
  fileSystem.__setFileSize(COMPRESSED_URI, 280 * 1024);
});

afterEach(() => {
  jest.restoreAllMocks();
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

    const url = await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(url).toBe('https://api.finnri.com/uploads/abc.jpg');
    const [, init] = fetchMock().mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    // Setting Content-Type manually drops the multipart boundary and the Go
    // server can no longer parse the body.
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain('content-type');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  // Expo's fetch builds the multipart body in JS and reads each part through
  // `bytes()`. The `{ uri, name, type }` object React Native used to accept
  // has none, and the upload died on "Unsupported FormDataPart implementation"
  // rather than on anything the user could act on.
  it('sends a part expo fetch can actually read', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    const part = uploadedPart();
    expect(part).toBeInstanceOf(File);
    expect(typeof part?.bytes).toBe('function');
    expect(part?.name).toBeTruthy();
    expect(part?.type).toBe('image/jpeg');
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

    await expect(uploadAttachment('token-1', CAMERA_PHOTO)).rejects.toThrow();
  });
});

describe('image compression', () => {
  it('downscales and re-encodes a camera photo before it leaves the device', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    // A 4000x3000 photo is constrained on its long edge, ratio preserved.
    expect(manipulator.__manipulatorState.resizes).toEqual([{ width: 1600 }]);
    expect(manipulator.__manipulatorState.saveOptions).toEqual({ compress: 0.7, format: 'jpeg' });
    expect(uploadedPart()?.uri).toBe(COMPRESSED_URI);
    expect(uploadedPart()?.size).toBe(280 * 1024);
  });

  it('constrains the height instead when the photo is portrait', async () => {
    manipulator.__manipulatorState.source = { width: 3000, height: 4000 };
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(manipulator.__manipulatorState.resizes).toEqual([{ height: 1600 }]);
  });

  it('re-encodes without resizing an image that is already small enough on screen', async () => {
    manipulator.__manipulatorState.source = { width: 1200, height: 900 };
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(manipulator.__manipulatorState.resizes).toEqual([]);
    expect(manipulator.__manipulatorState.saveOptions).toEqual({ compress: 0.7, format: 'jpeg' });
  });

  it('deletes the re-encoded copy once the upload is done', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(fileSystem.__deletedFiles).toContain(COMPRESSED_URI);
    expect(fileSystem.__deletedFiles).not.toContain(CAMERA_PHOTO);
  });

  it('deletes the re-encoded copy even when the upload fails', async () => {
    fetchMock().mockResolvedValueOnce(jsonResponse({ error: 'file_too_large' }, false, 413));

    await expect(uploadAttachment('token-1', CAMERA_PHOTO)).rejects.toThrow();

    expect(fileSystem.__deletedFiles).toContain(COMPRESSED_URI);
  });

  it('leaves a small image alone rather than re-encoding it for nothing', async () => {
    fileSystem.__setFileSize(CAMERA_PHOTO, 90 * 1024);
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(manipulator.__manipulatorState.saveOptions).toBeNull();
    expect(uploadedPart()?.uri).toBe(CAMERA_PHOTO);
  });

  it('never re-encodes a pdf', async () => {
    const pdf = 'file:///cache/bill.pdf';
    fileSystem.__setFileSize(pdf, 4 * 1024 * 1024);
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.pdf' }));

    await uploadAttachment('token-1', pdf);

    expect(manipulator.__manipulatorState.saveOptions).toBeNull();
    expect(uploadedPart()?.uri).toBe(pdf);
  });

  it('keeps the original when the re-encode comes out bigger', async () => {
    // A flat PNG screenshot can grow on its way to JPEG.
    fileSystem.__setFileSize(COMPRESSED_URI, 5 * 1024 * 1024);
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await uploadAttachment('token-1', CAMERA_PHOTO);

    expect(uploadedPart()?.uri).toBe(CAMERA_PHOTO);
    expect(fileSystem.__deletedFiles).toContain(COMPRESSED_URI);
  });

  it('still uploads at full size when the image cannot be decoded', async () => {
    manipulator.__manipulatorState.failNext = true;
    fetchMock().mockResolvedValueOnce(jsonResponse({ url: 'https://api.finnri.com/uploads/abc.jpg' }));

    await expect(uploadAttachment('token-1', CAMERA_PHOTO)).resolves.toBe(
      'https://api.finnri.com/uploads/abc.jpg'
    );
    expect(uploadedPart()?.uri).toBe(CAMERA_PHOTO);
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
