import { describe, expect, it } from 'vitest';
import { convertTextMainline, convertTextMitan, reverseConvertText } from '../utils/textConversionUtils';

describe('text conversion reverse flow', () => {
  it('reverses mitan output back to title and chapter text', () => {
    const source = ['《法正》', '==01==', '【==广陵王府==】', '法正：殿下', '（先看看情况）'].join('\n');
    const converted = convertTextMitan(source);

    expect(converted.success).toBe(true);

    const reversed = reverseConvertText(converted.output, 'mitan');

    expect(reversed).toEqual({
      success: true,
      output: source,
    });
  });

  it('reverses mainline output without injecting chapter markers', () => {
    const source = ['【==广陵王府==】', '法正：殿下', '（先看看情况）', '【风声渐起】'].join('\n');
    const converted = convertTextMainline(source);

    expect(converted.success).toBe(true);

    const reversed = reverseConvertText(converted.output, 'mainline');

    expect(reversed).toEqual({
      success: true,
      output: source,
    });
    expect(reversed.output).not.toContain('==01==');
  });

  it('reverses single-line mainline template output', () => {
    const source = ['【==广陵王府==】', '法正：殿下', '（先看看情况）', '【风声渐起】'].join('\n');
    const singleLineTemplate = [
      '{{对话-头}}',
      '{{旁白|【广陵王府】}}',
      '{{对话|法正|殿下}}',
      '{{旁白|心理|先看看情况}}',
      '{{旁白|风声渐起}}',
      '{{对话-尾}}',
    ].join('');

    const reversed = reverseConvertText(singleLineTemplate, 'mainline');

    expect(reversed).toEqual({
      success: true,
      output: source,
    });
  });

  it('treats mental text with full-width colon as narration instead of dialogue', () => {
    const converted = convertTextMainline('（先看看：情况）');

    expect(converted).toEqual({
      success: true,
      output: ['{{对话-头}}', '{{旁白|心理|先看看：情况}}', '{{对话-尾}}'].join('\n'),
    });
  });

  it('treats bracket narration with full-width colon as narration instead of dialogue', () => {
    const converted = convertTextMainline('【旁白：风声渐起】');

    expect(converted).toEqual({
      success: true,
      output: ['{{对话-头}}', '{{旁白|旁白：风声渐起}}', '{{对话-尾}}'].join('\n'),
    });
  });

  it('accepts mitan chapters beyond fixed two-digit input and normalizes on reverse', () => {
    const source = ['《法正》', '==123==', '法正：殿下'].join('\n');
    const converted = convertTextMitan(source);

    expect(converted).toEqual({
      success: true,
      output: ['{{密探故事录入|头|法正|123}}', '{{对话|法正|殿下}}', '{{密探故事录入|尾|法正|123}}'].join('\n'),
    });

    const reversed = reverseConvertText(converted.output, 'mitan');
    expect(reversed).toEqual({
      success: true,
      output: source,
    });
  });

  it('keeps bracketed aside payloads unchanged when reversing manual templates', () => {
    const reversed = reverseConvertText(
      ['{{对话-头}}', '{{旁白|【风声渐起】}}', '{{对话-尾}}'].join('\n'),
      'mainline',
    );

    expect(reversed).toEqual({
      success: true,
      output: '【==风声渐起==】',
    });
  });

  it('reverses manually edited mainline template text back to updated original text', () => {
    const editedTemplate = [
      '{{对话-头}}',
      '{{旁白|【广陵王府】}}',
      '{{对话|法正|殿下请留步}}',
      '{{旁白|心理|先看看新的情况}}',
      '{{对话-尾}}',
    ].join('\n');

    const reversed = reverseConvertText(editedTemplate, 'mainline');

    expect(reversed).toEqual({
      success: true,
      output: ['【==广陵王府==】', '法正：殿下请留步', '（先看看新的情况）'].join('\n'),
    });
  });

  it('reverses manually edited mitan template text back to updated original text', () => {
    const editedTemplate = [
      '{{密探故事录入|头|法正|02}}',
      '{{旁白|【书房】}}',
      '{{对话|法正|已经改好了}}',
      '{{密探故事录入|尾|法正|02}}',
    ].join('\n');

    const reversed = reverseConvertText(editedTemplate, 'mitan');

    expect(reversed).toEqual({
      success: true,
      output: ['《法正》', '==02==', '【==书房==】', '法正：已经改好了'].join('\n'),
    });
  });
});
