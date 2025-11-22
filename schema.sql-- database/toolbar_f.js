// src/components/ToolbarPlugin.jsx
import React, { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from 'lexical';
import { $patchStyleText } from '@lexical/selection';

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [fontSize, setFontSize] = useState('16px');
  const [fontFamily, setFontFamily] = useState('Arial');

  const formatText = useCallback((format) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  const handleFontSizeChange = (e) => {
    const size = e.target.value;
    setFontSize(size);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': size });
      }
    });
  };

  const handleFontFamilyChange = (e) => {
    const family = e.target.value;
    setFontFamily(family);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-family': family });
      }
    });
  };

  return (
    <div className="toolbar">
      <select value={fontFamily} onChange={handleFontFamilyChange} className="toolbar-select">
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
        <option value="Comic Sans MS">Comic Sans MS</option>
      </select>

      <select value={fontSize} onChange={handleFontSizeChange} className="toolbar-select">
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="28px">28px</option>
        <option value="32px">32px</option>
      </select>

      <button onClick={() => formatText('bold')} className="toolbar-btn" title="Bold">
        <strong>B</strong>
      </button>
      <button onClick={() => formatText('italic')} className="toolbar-btn" title="Italic">
        <em>I</em>
      </button>
      <button onClick={() => formatText('underline')} className="toolbar-btn" title="Underline">
        <u>U</u>
      </button>
    </div>
  );
}
