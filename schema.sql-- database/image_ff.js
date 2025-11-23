// src/components/ImagesPlugin.jsx
import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, DROP_COMMAND, DRAGOVER_COMMAND } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $createImageNode } from '../nodes/ImageNode';

export default function ImagesPlugin({ userId, documentId }) {
  const [editor] = useLexicalComposerContext();
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('userId', userId.toString());
    if (documentId) {
      formData.append('documentId', documentId.toString());
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/images/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Image uploaded successfully:', data.image);
        return data.image.url;
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  useEffect(() => {
    const removeDragOver = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event) => {
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const removeDrop = editor.registerCommand(
      DROP_COMMAND,
      (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;

        if (files.length > 0) {
          Array.from(files).forEach(async (file) => {
            if (file.type.startsWith('image/')) {
              try {
                setUploading(true);
                
                // Upload to server and get URL
                const imageUrl = await uploadImage(file);
                
                // Insert image node with URL
                editor.update(() => {
                  const imageNode = $createImageNode({
                    src: imageUrl,
                    altText: file.name,
                    maxWidth: 800,
                  });
                  
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    selection.insertNodes([imageNode]);
                  }
                });

                setUploading(false);
              } catch (error) {
                console.error('Failed to upload image:', error);
                setUploading(false);
                alert('Failed to upload image. Please try again.');
              }
            }
          });
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      removeDragOver();
      removeDrop();
    };
  }, [editor, userId, documentId]);

  // Show uploading indicator
  useEffect(() => {
    if (uploading) {
      const style = document.createElement('style');
      style.id = 'uploading-cursor';
      style.innerHTML = '* { cursor: wait !important; }';
      document.head.appendChild(style);
      
      return () => {
        const existingStyle = document.getElementById('uploading-cursor');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, [uploading]);

  return null;
}
