/**
 * Utility class for calculating text cursor positions and handling drag-drop positioning
 * in contenteditable elements with complex layouts and syntax highlighting.
 */
export class TextPositionCalculator {
  private element: HTMLElement;
  private computedStyle: CSSStyleDeclaration;
  
  constructor(element: HTMLElement) {
    this.element = element;
    this.computedStyle = window.getComputedStyle(element);
  }

  /**
   * Converts mouse coordinates to text cursor position with intelligent whitespace padding
   */
  calculateDropPosition(clientX: number, clientY: number, dropData: string): {
    insertPosition: number;
    paddedContent: string;
    updatedTextContent: string;
    updatedHTMLContent: string;
    caretPosition: number;
  } {
    console.log('🎯 Calculating drop position for coordinates:', { clientX, clientY });
    
    const elementRect = this.element.getBoundingClientRect();
    const textContent = this.element.textContent || '';
    const htmlContent = this.element.innerHTML || '';
    const currentStringLength = textContent.length;
    
    // Convert absolute coordinates to relative coordinates within the element
    const paddingLeft = parseFloat(this.computedStyle.paddingLeft) || 0;
    const paddingTop = parseFloat(this.computedStyle.paddingTop) || 0;
    
    const relativeX = clientX - elementRect.left - paddingLeft;
    const relativeY = clientY - elementRect.top - paddingTop;
    
    console.log('🎯 Relative coordinates (after padding):', { relativeX, relativeY });
    console.log('🎯 Current string length:', currentStringLength);
    
    // Calculate character dimensions
    const characterWidth = this.getCharacterWidth();
    const lineHeight = this.getLineHeight();
    
    console.log('🎯 Character dimensions:', { characterWidth, lineHeight });
    
    // Calculate using your corrected algorithm
    
    // Step 1: MaxCharactersPerLine = editableDivWidthInPixels / CharacterWidthInPixels
    const editableDivWidthInPixels = this.element.clientWidth - (paddingLeft * 2);
    const maxCharactersPerLine = Math.floor(editableDivWidthInPixels / characterWidth);
    
    // Step 2: RowNumberMouseIsOn = MouseY / LineHeight
    const rowNumberMouseIsOn = Math.floor(relativeY / lineHeight);
    
    // Step 3: MaxStringLength = RowNumberMouseIsOn * MaxCharactersPerLine
    const maxStringLength = rowNumberMouseIsOn * maxCharactersPerLine;
    
    console.log('🎯 Corrected algorithm calculations:', { 
      editableDivWidthInPixels,
      maxCharactersPerLine,
      rowNumberMouseIsOn,
      maxStringLength,
      currentStringLength
    });
    
    // Step 4: Padding = MaxStringLength - CurrentStringLength
    const padding = Math.max(0, maxStringLength - currentStringLength);
    
    console.log('🎯 Padding calculation:', padding);
    
    let insertPosition: number;
    let paddedContent: string;
    let updatedTextContent: string;
    let updatedHTMLContent: string = '';
    let caretPosition: number;
    
    if (padding > 0) {
      // Need padding to reach the target row
      console.log('🎯 Adding padding:', padding, 'spaces');
      
      // Step 5: CurrentStringValue = CurrentString + Padding + DropData
      let paddingSpaces = "";//.repeat(padding);

    for (let i = 0; i < padding; i++) {
        paddingSpaces += "&nbsp;";
    }
    
      updatedTextContent = textContent + paddingSpaces + dropData;
      updatedHTMLContent = htmlContent + paddingSpaces + dropData;
      // Insert position is at the end of current string
      insertPosition = updatedTextContent.length;
      paddedContent = paddingSpaces + dropData;
      
      // Step 6: SetCaretPosition(CurrentStringValue.Length)
      caretPosition = updatedTextContent.length;
    } else {
      // We're within the existing text area, insert at calculated position
      insertPosition = Math.max(0, Math.min(maxStringLength, currentStringLength));
      paddedContent = dropData;
      
      // Insert the dropData at the calculated position
      updatedTextContent = textContent.slice(0, insertPosition) + 
                          dropData + 
                          textContent.slice(insertPosition);
      
      // Set caret after the inserted content
      caretPosition = insertPosition + dropData.length;
    }
    
    console.log('🎯 Final result:', { 
      insertPosition, 
      paddedContent, 
      updatedTextContent: updatedTextContent.length + ' chars',
      caretPosition 
    });
    
    // Update the editable div with the new content
    this.element.textContent = updatedTextContent;
    
    return { 
      insertPosition, 
      paddedContent, 
      updatedTextContent,
      updatedHTMLContent,
      caretPosition 
    };
  }

  /**
   * Calculates the average character width for the current font
   */
  private getCharacterWidth(): number {
    const measuringElement = this.createMeasuringElement();
    
    // Use a representative string of characters to get average width
    // Using a mix of wide and narrow characters for better average
    const testString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    measuringElement.textContent = testString;
    
    const totalWidth = measuringElement.getBoundingClientRect().width;
    const averageWidth = totalWidth / testString.length;
    
    // Clean up
    measuringElement.remove();
    
    console.log('🎯 Character width calculation:', { totalWidth, characterCount: testString.length, averageWidth });
    return averageWidth;
  }

  /**
   * Calculates the line height for the element
   */
  private getLineHeight(): number {
    const lineHeight = this.computedStyle.lineHeight;
    
    if (lineHeight === 'normal') {
      // Estimate normal line height as 1.2 times font size
      const fontSize = parseFloat(this.computedStyle.fontSize) || 16;
      return fontSize * 1.2;
    } else if (lineHeight.endsWith('px')) {
      return parseFloat(lineHeight);
    } else if (lineHeight.endsWith('em') || lineHeight.endsWith('rem')) {
      const fontSize = parseFloat(this.computedStyle.fontSize) || 16;
      return parseFloat(lineHeight) * fontSize;
    } else {
      // Line height is a number (multiplier of font size)
      const fontSize = parseFloat(this.computedStyle.fontSize) || 16;
      return parseFloat(lineHeight) * fontSize;
    }
  }

  /**
   * Creates a temporary element for measuring text dimensions
   */
  private createMeasuringElement(): HTMLElement {
    const measuringElement = document.createElement('span');
    
    // Copy relevant styles from the target element
    const relevantStyles = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 
      'letterSpacing', 'wordSpacing', 'textTransform'
    ];
    
    relevantStyles.forEach(style => {
      (measuringElement.style as any)[style] = this.computedStyle.getPropertyValue(style.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));
    });
    
    // Make it invisible but measurable
    measuringElement.style.position = 'absolute';
    measuringElement.style.visibility = 'hidden';
    measuringElement.style.whiteSpace = 'pre';
    measuringElement.style.left = '-9999px';
    measuringElement.style.top = '-9999px';
    
    // Add to document for measurement
    document.body.appendChild(measuringElement);
    
    return measuringElement;
  }

  /**
   * Fallback method using browser APIs for simple cases
   */
  getSimpleTextPosition(clientX: number, clientY: number): number {
    try {
      const textContent = this.element.textContent || '';
      
      // Use browser APIs as fallback
      if (document.caretPositionFromPoint) {
        const caretPosition = document.caretPositionFromPoint(clientX, clientY);
        if (caretPosition && caretPosition.offsetNode) {
          return this.getTextOffsetFromNode(caretPosition.offsetNode, caretPosition.offset);
        }
      } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (range && range.startContainer) {
          return this.getTextOffsetFromNode(range.startContainer, range.startOffset);
        }
      }
      
      // Ultimate fallback
      return textContent.length;
    } catch (error) {
      console.warn('Error in simple text position calculation:', error);
      return 0;
    }
  }

  /**
   * Calculates text offset from a DOM node position
   */
  private getTextOffsetFromNode(targetNode: Node, offset: number): number {
    let textOffset = 0;
    
    // Create a tree walker to traverse all text nodes
    const walker = document.createTreeWalker(
      this.element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === targetNode) {
        return textOffset + offset;
      } else {
        textOffset += currentNode.textContent?.length || 0;
      }
    }
    
    // Handle element nodes
    if (targetNode.nodeType === Node.ELEMENT_NODE) {
      const rangeBefore = document.createRange();
      rangeBefore.setStart(this.element, 0);
      rangeBefore.setEnd(targetNode, 0);
      textOffset = rangeBefore.toString().length;
      
      if (offset > 0 && targetNode.childNodes.length > 0) {
        const childWalker = document.createTreeWalker(
          targetNode,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let childTextLength = 0;
        let nodeCount = 0;
        let childNode;
        
        while ((childNode = childWalker.nextNode()) && nodeCount < offset) {
          childTextLength += childNode.textContent?.length || 0;
          nodeCount++;
        }
        
        textOffset += childTextLength;
      }
    }
    
    return textOffset;
  }
}