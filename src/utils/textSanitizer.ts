import type { TextReplaceRule } from '@/types/textRules';

const MAX_LINE_LENGTH = 500;
const MAX_REPLACE_RULES = 50;
const MAX_REPLACE_REPLACEMENT_LENGTH = 1500;

let cachedReplaceKey: string | null = null;
let cachedCompiledReplaceRules: Array<{ re: RegExp; replacement: string }> = [];

type SanitizerSettings = {
  replaceRules: TextReplaceRule[];
};

function safeGetSanitizerSettings(): SanitizerSettings {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { replaceRules: [] };
    }
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) return { replaceRules: [] };
    const parsed = JSON.parse(raw);
    return {
      replaceRules: Array.isArray(parsed?.replaceRules) ? (parsed.replaceRules as TextReplaceRule[]) : [],
    };
  } catch {
    return { replaceRules: [] };
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReplaceFlags(rule: TextReplaceRule): string {
  const globalFlag = rule.global === false ? '' : 'g';
  const i = rule.ignoreCase ? 'i' : '';
  const m = rule.mode === 'regex' && rule.multiline ? 'm' : '';
  const s = rule.mode === 'regex' && rule.dotAll ? 's' : '';
  return `${globalFlag}${i}${m}${s}`;
}

function escapeReplacementForText(replacement: string): string {
  return replacement.replace(/\$/g, '$$$$');
}

function compileReplaceRules(rules: TextReplaceRule[]): Array<{ re: RegExp; replacement: string }> {
  const compiled: Array<{ re: RegExp; replacement: string }> = [];
  for (const rule of rules) {
    if (compiled.length >= MAX_REPLACE_RULES) break;
    if (!rule || rule.enabled === false) continue;
    if (typeof rule.pattern !== 'string' || !rule.pattern.trim()) continue;

    const pattern = rule.pattern.length > MAX_LINE_LENGTH ? rule.pattern.slice(0, MAX_LINE_LENGTH) : rule.pattern;
    const replacementRaw = typeof rule.replacement === 'string' ? rule.replacement : '';
    const replacement =
      rule.mode === 'text'
        ? escapeReplacementForText(replacementRaw.slice(0, MAX_REPLACE_REPLACEMENT_LENGTH))
        : replacementRaw.slice(0, MAX_REPLACE_REPLACEMENT_LENGTH);

    try {
      if (rule.mode === 'text') {
        const flags = `${rule.global === false ? '' : 'g'}${rule.ignoreCase ? 'i' : ''}`;
        compiled.push({ re: new RegExp(escapeRegExp(pattern), flags), replacement });
      } else {
        const flags = buildReplaceFlags(rule);
        compiled.push({ re: new RegExp(pattern, flags), replacement });
      }
    } catch {
      // ignore invalid rule
    }
  }
  return compiled;
}

function getCompiledReplaceRules(): Array<{ re: RegExp; replacement: string }> {
  const settings = safeGetSanitizerSettings();
  const settingsKey = JSON.stringify(settings.replaceRules || []);
  if (settingsKey === cachedReplaceKey) return cachedCompiledReplaceRules;

  cachedReplaceKey = settingsKey;
  cachedCompiledReplaceRules = compileReplaceRules(settings.replaceRules || []);
  return cachedCompiledReplaceRules;
}

function sanitizeWithRules(
  text: string,
  replaceRules: Array<{ re: RegExp; replacement: string }>,
): string {
  if (!text) return '';

  let result = text;

  // Built-in: remove thinking/analysis blocks and leftover tags.
  // 支持多种变体：<thinking>, <Thinking>, <antThinking>, <ant-thinking> 等
  result = result
    .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<\/?analysis>/gi, '')
    // 移除可能的reasoning标签
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\/?reasoning>/gi, '')
    // 移除可能的thought标签
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<\/?thought>/gi, '');

  for (const rule of replaceRules) {
    result = result.replace(rule.re, rule.replacement);
  }

  return result;
}

export function sanitizeAITextForDisplay(text: string): string {
  return sanitizeWithRules(text, getCompiledReplaceRules());
}

/**
 * 从完整的 JSON 响应中提取 text 字段
 * 用于最终显示时调用，不用于流式过程中
 */
export function extractTextFromJsonResponse(text: string): string {
  if (!text) return '';

  // 先移除 thinking 类标签
  const cleaned = text
    .replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, '')
    .replace(/<\/?think[^>]*>/gi, '')
    .trim();

  // 查找 JSON 对象
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return cleaned;
  }

  const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    // JSON 解析失败，返回原文
  }

  return cleaned;
}

/**
 * 从流式累积文本中增量提取 {"text":"..."} 的 text 内容
 *
 * 与 extractTextFromJsonResponse 不同，此函数能处理不完整的 JSON（缺少闭合 }），
 * 适用于流式输出场景：每收到一个 chunk 就调用一次，实时显示正文。
 *
 * - 检测到 {"text":" 前缀时，增量提取 text 值（处理 JSON 转义序列）
 * - 未检测到 JSON 格式时（Tavern 纯文本模式），回退到 sanitizeAITextForDisplay
 */
export function extractStreamingTextContent(accumulated: string): string {
  if (!accumulated) return '';

  // 先移除 thinking 类标签（安全兜底）
  const cleaned = accumulated
    .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\/?reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<\/?thought>/gi, '')
    .trim();

  if (!cleaned) return '';

  // 查找 {"text":" 前缀（可能有空格，用正则匹配）
  const prefixMatch = cleaned.match(/\{\s*"text"\s*:\s*"/);
  if (!prefixMatch) {
    // 非 JSON 格式，按纯文本处理
    return sanitizeAITextForDisplay(cleaned);
  }

  const prefixEnd = (prefixMatch.index ?? 0) + prefixMatch[0].length;

  // 尝试完整 JSON 解析（流式结束时可能已完整）
  try {
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonEnd > jsonStart) {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      if (typeof parsed.text === 'string') return parsed.text;
    }
  } catch {
    // JSON 不完整，走手动提取
  }

  // 手动提取：从 prefixEnd 开始，找到第一个未被转义的 " 作为结尾
  // 如果找不到闭合引号，说明 text 值仍在流式中，取全部内容
  const afterPrefix = cleaned.substring(prefixEnd);
  let textEnd = -1;

  for (let i = 0; i < afterPrefix.length; i++) {
    if (afterPrefix[i] === '"') {
      // 检查前面有多少个连续反斜杠
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && afterPrefix[j] === '\\') {
        backslashes++;
        j--;
      }
      // 偶数个反斜杠 → 引号未被转义 → 这就是 text 值的结尾
      if (backslashes % 2 === 0) {
        textEnd = i;
        break;
      }
    }
  }

  const rawText = textEnd >= 0
    ? afterPrefix.substring(0, textEnd)
    : afterPrefix;

  // 反转义 JSON 字符串中的转义序列
  return rawText
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
