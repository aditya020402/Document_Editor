// src/components/ImagesPlugin.jsx
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, DROP_COMMAND, DRAGOVER_COMMAND } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $createImageNode } from '../nodes/ImageNode';

export default function ImagesPlugin() {
  const [editor] = useLexicalComposerContext();

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
          Array.from(files).forEach((file) => {
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              
              reader.onload = () => {
                editor.update(() => {
                  const imageNode = $createImageNode({
                    src: reader.result,
                    altText: file.name,
                    maxWidth: 800,
                  });
                  
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    selection.insertNodes([imageNode]);
                  }
                });
              };
              
              reader.readAsDataURL(file);
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
  }, [editor]);

  return null;
}
