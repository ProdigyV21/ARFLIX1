/**
 * Advanced Subtitle Processor
 * Supports: SRT, VTT, ASS (basic)
 * Features: Format conversion, styling, auto-sync
 */

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number;
  text: string;
  styles?: {
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    position?: 'top' | 'middle' | 'bottom';
    alignment?: 'left' | 'center' | 'right';
  };
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

/**
 * Parse SRT subtitle format
 */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Line 0: index
    const id = lines[0].trim();
    
    // Line 1: timestamp (00:00:20,000 --> 00:00:24,400)
    const timestampMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );
    
    if (!timestampMatch) continue;

    const [_, h1, m1, s1, ms1, h2, m2, s2, ms2] = timestampMatch;
    const startTime = 
      parseInt(h1) * 3600 + 
      parseInt(m1) * 60 + 
      parseInt(s1) + 
      parseInt(ms1) / 1000;
    
    const endTime = 
      parseInt(h2) * 3600 + 
      parseInt(m2) * 60 + 
      parseInt(s2) + 
      parseInt(ms2) / 1000;

    // Lines 2+: text
    const text = lines.slice(2).join('\n');

    cues.push({
      id,
      startTime,
      endTime,
      text,
    });
  }

  return cues;
}

/**
 * Parse VTT subtitle format
 */
export function parseVTT(content: string): SubtitleCue[] {
  // Remove WEBVTT header
  const withoutHeader = content.replace(/^WEBVTT.*?\n\n/s, '');
  
  const cues: SubtitleCue[] = [];
  const blocks = withoutHeader.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Line 0: id (optional) or timestamp
    // Line 1: timestamp if id is present, or text if no id
    let timestampLine = lines[0];
    let textStartIndex = 1;
    let id = '';

    // Check if first line is an id
    if (!timestampLine.includes('-->')) {
      id = timestampLine;
      timestampLine = lines[1];
      textStartIndex = 2;
    }

    // Parse timestamp (00:00:20.000 --> 00:00:24.400)
    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    
    if (!timestampMatch) continue;

    const [_, h1, m1, s1, ms1, h2, m2, s2, ms2] = timestampMatch;
    const startTime = 
      parseInt(h1) * 3600 + 
      parseInt(m1) * 60 + 
      parseInt(s1) + 
      parseInt(ms1) / 1000;
    
    const endTime = 
      parseInt(h2) * 3600 + 
      parseInt(m2) * 60 + 
      parseInt(s2) + 
      parseInt(ms2) / 1000;

    const text = lines.slice(textStartIndex).join('\n');

    cues.push({
      id: id || `${cues.length + 1}`,
      startTime,
      endTime,
      text,
    });
  }

  return cues;
}

/**
 * Parse ASS/SSA subtitle format (basic support)
 */
export function parseASS(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');
  
  let inEvents = false;
  let formatIndices: Record<string, number> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '[Events]') {
      inEvents = true;
      continue;
    }

    if (!inEvents) continue;

    // Parse format line
    if (trimmed.startsWith('Format:')) {
      const fields = trimmed
        .substring(7)
        .split(',')
        .map(f => f.trim());
      
      fields.forEach((field, index) => {
        formatIndices[field] = index;
      });
      continue;
    }

    // Parse dialogue line
    if (trimmed.startsWith('Dialogue:')) {
      const parts = trimmed.substring(9).split(',');
      
      const startIdx = formatIndices['Start'];
      const endIdx = formatIndices['End'];
      const textIdx = formatIndices['Text'];

      if (startIdx === undefined || endIdx === undefined || textIdx === undefined) {
        continue;
      }

      // Parse time (0:00:20.00)
      const startTime = parseASSTime(parts[startIdx]);
      const endTime = parseASSTime(parts[endIdx]);
      
      // Text is everything after the text field index
      const text = parts.slice(textIdx).join(',').replace(/\\N/g, '\n');

      cues.push({
        id: `${cues.length + 1}`,
        startTime,
        endTime,
        text: stripASSFormatting(text),
      });
    }
  }

  return cues;
}

/**
 * Parse ASS timestamp (0:00:20.00)
 */
function parseASSTime(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return 0;

  const [_, h, m, s, cs] = match;
  return (
    parseInt(h) * 3600 +
    parseInt(m) * 60 +
    parseInt(s) +
    parseInt(cs) / 100
  );
}

/**
 * Strip ASS formatting tags
 */
function stripASSFormatting(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '') // Remove all {tags}
    .trim();
}

/**
 * Convert subtitle cues to VTT format
 */
export function convertToVTT(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';

  for (const cue of cues) {
    vtt += `${cue.id}\n`;
    vtt += `${formatVTTTime(cue.startTime)} --> ${formatVTTTime(cue.endTime)}\n`;
    vtt += `${cue.text}\n\n`;
  }

  return vtt;
}

/**
 * Format time for VTT (00:00:20.000)
 */
function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

/**
 * Pad number with zeros
 */
function pad(num: number, size: number): string {
  return num.toString().padStart(size, '0');
}

/**
 * Auto-detect subtitle format
 */
export function detectFormat(content: string): SubtitleFormat {
  const trimmed = content.trim();
  
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }
  
  if (trimmed.includes('[Script Info]') || trimmed.includes('[Events]')) {
    return 'ass';
  }
  
  return 'srt'; // Default to SRT
}

/**
 * Parse subtitle file content
 */
export function parseSubtitleFile(content: string, format?: SubtitleFormat): SubtitleCue[] {
  const detectedFormat = format || detectFormat(content);
  
  switch (detectedFormat) {
    case 'vtt':
      return parseVTT(content);
    case 'ass':
      return parseASS(content);
    case 'srt':
    default:
      return parseSRT(content);
  }
}

/**
 * Adjust subtitle timing (for sync)
 */
export function adjustTiming(cues: SubtitleCue[], offsetSeconds: number): SubtitleCue[] {
  return cues.map(cue => ({
    ...cue,
    startTime: Math.max(0, cue.startTime + offsetSeconds),
    endTime: Math.max(0, cue.endTime + offsetSeconds),
  }));
}

/**
 * Get active subtitle at current time
 */
export function getActiveCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  return cues.find(
    cue => currentTime >= cue.startTime && currentTime <= cue.endTime
  ) || null;
}
