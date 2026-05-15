import {
  Anchor,
  Box,
  Center,
  Group,
  HoverCard,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text
} from '@mantine/core';
import {
  IconFile,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileTypeZip,
  IconFileUnknown,
  IconLink,
  IconPhoto
} from '@tabler/icons-react';
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { cancelEvent } from '@lib/functions/Events';
import { generateUrl } from '../../functions/urls';

type AttachmentPreviewKind =
  | 'pdf'
  | 'image'
  | 'text'
  | 'csv'
  | 'excel'
  | 'docx'
  | 'unsupported';

type AttachmentPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string }
  | { status: 'text'; text: string }
  | { status: 'csv'; rows: string[][]; text: string }
  | { status: 'excel'; rows: string[][]; sheetName: string }
  | { status: 'docx'; html: string }
  | { status: 'media'; kind: 'pdf' | 'image'; objectUrl: string };

const TEXT_CONTENT_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/rtf',
  'application/x-javascript',
  'application/x-yaml',
  'application/xhtml+xml',
  'application/xml',
  'application/yaml'
]);

const TEXT_FILE_EXTENSIONS = new Set([
  'htm',
  'html',
  'js',
  'json',
  'log',
  'md',
  'rtf',
  'ts',
  'txt',
  'xml',
  'yaml',
  'yml'
]);

const IMAGE_CONTENT_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'image/webp'
]);

const IMAGE_FILE_TYPES = new Map([
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['webp', 'image/webp']
]);

const EXCEL_CONTENT_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12'
]);

const EXCEL_FILE_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm']);

const DOCX_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const DOCX_FILE_EXTENSIONS = new Set(['docx']);

const MAX_HOVER_ROWS = 12;
const MAX_HOVER_COLUMNS = 8;

function attachmentExtension(attachment: string): string {
  const filename = attachment.split(/[?#]/)[0]?.split('/').pop() ?? '';
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function mediaType(contentType: string | null): string {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
}

function previewKind(
  contentType: string | null,
  attachment: string
): AttachmentPreviewKind {
  const type = mediaType(contentType);
  const extension = attachmentExtension(attachment);

  if (type === 'text/csv' || type === 'application/csv' || extension === 'csv') {
    return 'csv';
  }

  if (EXCEL_CONTENT_TYPES.has(type) || EXCEL_FILE_EXTENSIONS.has(extension)) {
    return 'excel';
  }

  if (DOCX_CONTENT_TYPES.has(type) || DOCX_FILE_EXTENSIONS.has(extension)) {
    return 'docx';
  }

  if (type === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  if (type.startsWith('image/') || IMAGE_FILE_TYPES.has(extension)) {
    return 'image';
  }

  if (
    type.startsWith('text/') ||
    TEXT_CONTENT_TYPES.has(type) ||
    TEXT_FILE_EXTENSIONS.has(extension)
  ) {
    return 'text';
  }

  return 'unsupported';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCsvPreview(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length && rows.length < 8; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function previewTableHtml(rows: string[][]): string {
  if (rows.length === 0) {
    return '<pre></pre>';
  }

  return `<table>${rows
    .map((row) => {
      return `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('')}</table>`;
}

function workbookPreviewRows(workbook: XLSX.WorkBook, maxRows?: number): {
  rows: string[][];
  sheetName: string;
} {
  const sheetName = workbook.SheetNames[0] ?? '';
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    return { rows: [], sheetName: sheetName || 'Sheet 1' };
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  const limitedRows = typeof maxRows === 'number' ? rows.slice(0, maxRows) : rows;

  return {
    sheetName,
    rows: limitedRows.map((row) => {
      const limitedRow = row.slice(0, MAX_HOVER_COLUMNS);
      return limitedRow.map((cell) => String(cell ?? ''));
    })
  };
}

function workbookPreviewHtml(workbook: XLSX.WorkBook): string {
  const { rows, sheetName } = workbookPreviewRows(workbook);
  return `<section class="message"><strong>Sheet:</strong> ${escapeHtml(sheetName)}</section>${previewTableHtml(rows)}`;
}

function sanitizedDocxHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  });
}

function previewHtml(title: string, content: string): string {
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, sans-serif; background: Canvas; color: CanvasText; }
header { padding: 1rem; border-bottom: 1px solid ButtonBorder; }
h1 { margin: 0; font-size: 1rem; line-height: 1.4; }
main { height: calc(100vh - 3.5rem); }
iframe, img { width: 100%; height: 100%; border: 0; }
img { box-sizing: border-box; object-fit: contain; padding: 1rem; }
pre { box-sizing: border-box; height: 100%; margin: 0; overflow: auto; padding: 1rem; white-space: pre-wrap; word-break: break-word; font: 0.875rem/1.5 ui-monospace, monospace; }
table { border-collapse: collapse; margin: 1rem; width: calc(100% - 2rem); font: 0.875rem/1.5 ui-monospace, monospace; }
td { border: 1px solid ButtonBorder; padding: 0.5rem; vertical-align: top; }
.message { box-sizing: border-box; max-width: 44rem; padding: 1rem; line-height: 1.5; }
</style>
</head>
<body>
<header><h1>${safeTitle}</h1></header>
<main>${content}</main>
</body>
</html>`;
}

function writePreviewWindow(
  previewWindow: Window,
  title: string,
  content: string
): void {
  if (previewWindow.closed) {
    return;
  }

  previewWindow.document.open();
  previewWindow.document.write(previewHtml(title, content));
  previewWindow.document.close();
}

function typedPreviewBlob(
  blob: Blob,
  kind: AttachmentPreviewKind,
  contentType: string | null,
  attachment: string
): Blob {
  const type = mediaType(contentType) || mediaType(blob.type);
  const extension = attachmentExtension(attachment);

  if (kind === 'pdf' && type !== 'application/pdf') {
    return new Blob([blob], { type: 'application/pdf' });
  }

  const imageType = IMAGE_FILE_TYPES.get(extension);
  if (kind === 'image' && imageType && !IMAGE_CONTENT_TYPES.has(type)) {
    return new Blob([blob], { type: imageType });
  }

  return blob;
}

async function openUploadedAttachmentPreview(
  previewWindow: Window,
  url: string,
  attachment: string,
  title: string
): Promise<void> {
  writePreviewWindow(
    previewWindow,
    title,
    '<div class="message">Đang tải nội dung xem trước...</div>'
  );

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type;
    const kind = previewKind(contentType, attachment);

    if (kind === 'unsupported') {
      writePreviewWindow(
        previewWindow,
        title,
        '<div class="message">Không thể xem trước định dạng tệp này. Vui lòng dùng chức năng Download trong menu thao tác của dòng tài liệu để tải tệp.</div>'
      );
      return;
    }

    if (kind === 'text' || kind === 'csv') {
      const text = await blob.text();
      const content =
        kind === 'csv'
          ? previewTableHtml(parseCsvPreview(text))
          : `<pre>${escapeHtml(text)}</pre>`;
      writePreviewWindow(previewWindow, title, content);
      return;
    }

    if (kind === 'excel') {
      const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
      writePreviewWindow(previewWindow, title, workbookPreviewHtml(workbook));
      return;
    }

    if (kind === 'docx') {
      const result = await mammoth.convertToHtml({
        arrayBuffer: await blob.arrayBuffer()
      });
      writePreviewWindow(
        previewWindow,
        title,
        `<article class="message">${sanitizedDocxHtml(result.value)}</article>`
      );
      return;
    }

    const previewBlob = typedPreviewBlob(blob, kind, contentType, attachment);
    const objectUrl = URL.createObjectURL(previewBlob);
    const previewContent =
      kind === 'pdf'
        ? `<iframe src="${escapeHtml(objectUrl)}" title="${escapeHtml(title)}"></iframe>`
        : `<img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(title)}">`;

    writePreviewWindow(previewWindow, title, previewContent);
    previewWindow.addEventListener(
      'pagehide',
      () => {
        URL.revokeObjectURL(objectUrl);
      },
      { once: true }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    writePreviewWindow(
      previewWindow,
      title,
      `<div class="message">Không thể tải nội dung xem trước. Vui lòng dùng chức năng Download trong menu thao tác của dòng tài liệu để tải tệp.<br><br>${escapeHtml(message)}</div>`
    );
  }
}

async function loadAttachmentPreview(
  url: string,
  attachment: string
): Promise<AttachmentPreviewState> {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type;
  const kind = previewKind(contentType, attachment);

  if (kind === 'unsupported') {
    return {
      status: 'unsupported',
      message:
        'Không thể xem trước định dạng tệp này. Vui lòng dùng chức năng Download trong menu thao tác của dòng tài liệu để tải tệp.'
    };
  }

  if (kind === 'text' || kind === 'csv') {
    const text = await blob.text();
    const previewText = text.length > 4000 ? `${text.slice(0, 4000)}...` : text;

    if (kind === 'csv') {
      return {
        status: 'csv',
        rows: parseCsvPreview(previewText),
        text: previewText
      };
    }

    return {
      status: 'text',
      text: previewText
    };
  }

  if (kind === 'excel') {
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
    const { rows, sheetName } = workbookPreviewRows(workbook, MAX_HOVER_ROWS);

    return {
      status: 'excel',
      rows,
      sheetName
    };
  }

  if (kind === 'docx') {
    const result = await mammoth.convertToHtml({
      arrayBuffer: await blob.arrayBuffer()
    });

    return {
      status: 'docx',
      html: sanitizedDocxHtml(result.value)
    };
  }

  const previewBlob = typedPreviewBlob(blob, kind, contentType, attachment);
  return {
    status: 'media',
    kind: kind,
    objectUrl: URL.createObjectURL(previewBlob)
  };
}

function PreviewMessage({ message }: Readonly<{ message: string }>) {
  return (
    <Paper p='sm' radius='md' withBorder>
      <Text size='sm' c='dimmed'>
        {message}
      </Text>
    </Paper>
  );
}

function AttachmentPreviewContent({
  preview,
  title
}: Readonly<{
  preview: AttachmentPreviewState;
  title: string;
}>) {
  if (preview.status === 'idle') {
    return <PreviewMessage message='Di chuột để tải nội dung xem trước.' />;
  }

  if (preview.status === 'loading') {
    return (
      <Center h={160}>
        <Stack gap='xs' align='center'>
          <Loader size='sm' />
          <Text size='sm' c='dimmed'>
            Đang tải nội dung xem trước...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (preview.status === 'unsupported' || preview.status === 'error') {
    return <PreviewMessage message={preview.message} />;
  }

  if (preview.status === 'text') {
    return (
      <ScrollArea h={220} type='auto'>
        <Text component='pre' size='xs' ff='monospace' m={0}>
          {preview.text}
        </Text>
      </ScrollArea>
    );
  }

  if (preview.status === 'csv') {
    return (
      <ScrollArea h={220} type='auto'>
        {preview.rows.length > 0 ? (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Tbody>
              {preview.rows.map((row, rowIndex) => (
                <Table.Tr key={`preview-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <Table.Td key={`preview-cell-${rowIndex}-${cellIndex}`}>
                      <Text size='xs' ff='monospace'>
                        {cell}
                      </Text>
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text component='pre' size='xs' ff='monospace' m={0}>
            {preview.text}
          </Text>
        )}
      </ScrollArea>
    );
  }

  if (preview.status === 'excel') {
    return (
      <Stack gap='xs'>
        <Text size='xs' c='dimmed'>
          Sheet: {preview.sheetName}
        </Text>
        <ScrollArea h={220} type='auto'>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Tbody>
              {preview.rows.map((row, rowIndex) => (
                <Table.Tr key={`excel-preview-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <Table.Td key={`excel-preview-cell-${rowIndex}-${cellIndex}`}>
                      <Text size='xs' ff='monospace'>
                        {cell}
                      </Text>
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    );
  }

  if (preview.status === 'docx') {
    return (
      <ScrollArea h={220} type='auto'>
        <Box
          fz='sm'
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
      </ScrollArea>
    );
  }

  return preview.kind === 'pdf' ? (
    <Box
      component='iframe'
      src={preview.objectUrl}
      title={title}
      h={260}
      w={360}
      style={{ border: 0 }}
    />
  ) : (
    <Box
      component='img'
      src={preview.objectUrl}
      alt={title}
      maw={360}
      mah={260}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}

function AttachmentPreviewHoverCard({
  attachment,
  external,
  title,
  url,
  children
}: Readonly<{
  attachment: string;
  external?: boolean;
  title: string;
  url: string;
  children: ReactNode;
}>) {
  const [preview, setPreview] = useState<AttachmentPreviewState>({
    status: 'idle'
  });

  useEffect(() => {
    return () => {
      if (preview.status === 'media') {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [preview]);

  const loadPreview = useCallback(() => {
    if (preview.status !== 'idle' || !attachment) {
      return;
    }

    if (external) {
      setPreview({
        status: 'unsupported',
        message: 'Liên kết ngoài sẽ mở trong tab mới và không có bản xem trước nhúng.'
      });
      return;
    }

    setPreview({ status: 'loading' });
    void loadAttachmentPreview(url, attachment)
      .then((nextPreview) => setPreview(nextPreview))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setPreview({
          status: 'error',
          message: `Không thể tải nội dung xem trước. ${message}`
        });
      });
  }, [attachment, external, preview.status, url]);

  return (
    <HoverCard
      withinPortal={true}
      openDelay={300}
      closeDelay={80}
      position='right-start'
      shadow='md'
    >
      <HoverCard.Target>
        <Box component='span' onMouseEnter={loadPreview} onFocus={loadPreview}>
          {children}
        </Box>
      </HoverCard.Target>
      <HoverCard.Dropdown maw={420}>
        <Stack gap='xs'>
          <Group gap='xs' wrap='nowrap'>
            {external ? <IconLink size={18} /> : attachmentIcon(attachment)}
            <Text size='sm' fw={600} lineClamp={1}>
              {title}
            </Text>
          </Group>
          <AttachmentPreviewContent preview={preview} title={title} />
          <Text size='xs' c='dimmed'>
            Nhấp đúp để mở bản xem trước trong tab mới.
          </Text>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

export function openAttachmentPreviewTab({
  attachment,
  title,
  url
}: Readonly<{
  attachment: string;
  title: string;
  url: string;
}>): void {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    return;
  }

  previewWindow.opener = null;
  void openUploadedAttachmentPreview(previewWindow, url, attachment, title);
}

/**
 * Return an icon based on the provided filename
 */
export function attachmentIcon(attachment: string, size = 18): ReactNode {
  if (!attachment) {
    return <IconFileUnknown size={size} />;
  }

  const suffix = attachment.split('.').pop()?.toLowerCase() ?? '';
  switch (suffix) {
    case 'pdf':
      return <IconFileTypePdf size={size} />;
    case 'csv':
      return <IconFileTypeCsv size={size} />;
    case 'xls':
    case 'xlsx':
      return <IconFileTypeXls size={size} />;
    case 'doc':
    case 'docx':
      return <IconFileTypeDoc size={size} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case '7z':
      return <IconFileTypeZip size={size} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'tif':
    case 'webp':
      return <IconPhoto size={size} />;
    default:
      return <IconFile size={size} />;
  }
}

/**
 * Render a link to a file attachment, with icon and text
 * @param attachment : string - The attachment filename
 */
export function AttachmentLink({
  attachment,
  external
}: Readonly<{
  attachment: string;
  external?: boolean;
}>): ReactNode {
  const url = useMemo(() => {
    if (external) {
      return attachment;
    }

    return generateUrl(attachment);
  }, [attachment, external]);

  const text: string = useMemo(() => {
    if (!attachment) {
      return '-';
    }

    return external ? attachment : (attachment.split('/').pop() ?? '-');
  }, [attachment, external]);

  const previewAttachment = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      cancelEvent(event);
      openAttachmentPreviewTab({ attachment, title: text, url });
    },
    [attachment, text, url]
  );

  const blockSingleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      cancelEvent(event);
    },
    []
  );

  return (
    <Group justify='left' gap='sm' wrap='nowrap'>
      {external ? <IconLink /> : attachmentIcon(attachment)}
      {!!attachment ? (
        external ? (
          <Anchor href={url} target='_blank' rel='noopener noreferrer'>
            {text}
          </Anchor>
        ) : (
          <AttachmentPreviewHoverCard
            attachment={attachment}
            external={external}
            title={text}
            url={url}
          >
            <Anchor
              href='#'
              target='_blank'
              rel='noopener noreferrer'
              onClick={blockSingleClick}
              onAuxClick={blockSingleClick}
              onDoubleClick={previewAttachment}
            >
              {text}
            </Anchor>
          </AttachmentPreviewHoverCard>
        )
      ) : (
        text
      )}
    </Group>
  );
}
