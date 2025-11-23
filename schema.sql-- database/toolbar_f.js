// src/components/ToolbarPlugin.jsx (Updated with image upload button)
import React, { useCallback, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { $createImageNode } from '../nodes/ImageNode';

export default function ToolbarPlugin({ userId, documentId }) {
  const [editor] = useLexicalComposerContext();
  const [fontSize, setFontSize] = useState('16px');
  const [fontFamily, setFontFamily] = useState('Arial');
  const fileInputRef = useRef(null);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', userId.toString());
      if (documentId) {
        formData.append('documentId', documentId.toString());
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/images/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        editor.update(() => {
          const imageNode = $createImageNode({
            src: data.image.url,
            altText: file.name,
            maxWidth: 800,
          });
          
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([imageNode]);
          }
        });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

      <div className="toolbar-divider"></div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <button 
        onClick={() => fileInputRef.current?.click()} 
        className="toolbar-btn" 
        title="Insert Image"
      >
        🖼️
      </button>
    </div>
  );
}
