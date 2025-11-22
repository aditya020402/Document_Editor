// src/nodes/ImageNode.jsx
import { DecoratorNode } from 'lexical';

export class ImageNode extends DecoratorNode {
  __src;
  __altText;
  __maxWidth;

  static getType() {
    return 'image';
  }

  static clone(node) {
    return new ImageNode(node.__src, node.__altText, node.__maxWidth, node.__key);
  }

  constructor(src, altText, maxWidth, key) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__maxWidth = maxWidth || 800;
  }

  createDOM() {
    const div = document.createElement('div');
    div.style.display = 'inline-block';
    div.style.margin = '10px 0';
    return div;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        style={{ maxWidth: this.__maxWidth + 'px', width: '100%', height: 'auto' }}
      />
    );
  }

  static importJSON(serializedNode) {
    const { src, altText, maxWidth } = serializedNode;
    return $createImageNode({ src, altText, maxWidth });
  }

  exportJSON() {
    return {
      type: 'image',
      src: this.__src,
      altText: this.__altText,
      maxWidth: this.__maxWidth,
      version: 1,
    };
  }
}

export function $createImageNode({ src, altText, maxWidth }) {
  return new ImageNode(src, altText, maxWidth);
}

export function $isImageNode(node) {
  return node instanceof ImageNode;
}
