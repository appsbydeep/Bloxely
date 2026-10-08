import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { BlockLayout, WorkspaceBlock } from '../types/workspace';

interface FreeLayoutManagerProps {
  children: React.ReactNode;
  generatedBlocks?: WorkspaceBlock[];
  onGeneratedLayoutChange?: (blockId: string, layout: BlockLayout) => void;
}

interface WidgetSize {
  id: string;
  width: number;
  height: number;
}

/**
 * Get the current zoom level from the canvas container
 */
const getCanvasZoomLevel = (): number => {
  const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
  if (!canvasContainer) return 1;
  
  const transform = window.getComputedStyle(canvasContainer).transform;
  if (transform && transform !== 'none') {
    const matrix = new DOMMatrix(transform);
    return matrix.a; // scale factor
  }
  return 1;
};

/**
 * Free layout manager that displays widgets with unrestricted movement
 * similar to Miro, using refs for positions to prevent React re-render issues.
 */
const FreeLayoutManager: React.FC<FreeLayoutManagerProps> = ({ children, generatedBlocks, onGeneratedLayoutChange }) => {
  const childArray = React.Children.toArray(children) as React.ReactElement[];
  const generatedLayouts = useMemo(() => new Map(generatedBlocks?.map(block => [block.id, block.layout]) ?? []), [generatedBlocks]);
  const generatedCanvasHeight = generatedBlocks?.length
    ? Math.max(...generatedBlocks.map(block => block.layout.y + block.layout.height + 48)) : undefined;
  const [widgetSizes, setWidgetSizes] = useState<WidgetSize[]>([]);
  const widgetPositionsRef = useRef<Record<string, {x: number, y: number}>>({});
  const resizingWidget = useRef<{id: string, startX: number, startY: number, startWidth: number, startHeight: number, element: HTMLElement} | null>(null);
  const draggingWidget = useRef<{id: string, startX: number, startY: number, startLeft: number, startTop: number, element: HTMLElement} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize widget sizes and positions
  React.useEffect(() => {
    const hasNewWidgets = childArray.some((child, idx) => {
      const props: any = child.props || {};
      const widgetId = props.widget?.id || props.widgetId || props['data-widget-id'] || `child-${idx}`;
      return !widgetSizes.some(size => size.id === widgetId);
    });
    
    // Always update for new widgets, but only initialize once for the initial set
    if (!initializedRef.current || hasNewWidgets) {
      // Mark this pass before setWidgetSizes triggers another render.
      initializedRef.current = true;
      const initialSizes: WidgetSize[] = childArray.map((child, idx) => {
        const props: any = child.props || {};
        const widgetId = props.widget?.id || props.widgetId || props['data-widget-id'] || `child-${idx}`;
        const generatedLayout = generatedLayouts.get(widgetId);
        if (generatedLayout) return { id: widgetId, width: generatedLayout.width, height: generatedLayout.height };
        
        // Check if we already have a size for this widget
        const existingSize = widgetSizes.find(size => size.id === widgetId);
        if (existingSize) {
          return existingSize;
        }
        
        // Try to load size from localStorage first
        try {
          const storageKey = `widget-size-${widgetId}`;
          const savedSize = localStorage.getItem(storageKey);
          if (savedSize) {
            const sizeData = JSON.parse(savedSize);
            console.log('Restored widget size from localStorage:', widgetId, sizeData.width, sizeData.height);
            return {
              id: widgetId,
              width: sizeData.width,
              height: sizeData.height
            };
          }
        } catch (error) {
          console.warn('Failed to load saved size for widget:', widgetId, error);
        }
        
        // Default size if no saved size found
        return {
          id: widgetId,
          width: 300,
          height: 300
        };
      });
      
      setWidgetSizes(initialSizes);
      
      // Initialize positions in ref for new widgets
      childArray.forEach((child, idx) => {
        const props: any = child.props || {};
        const widgetId = props.widget?.id || props.widgetId || props['data-widget-id'] || `child-${idx}`;
        const generatedLayout = generatedLayouts.get(widgetId);
        if (generatedLayout) {
          widgetPositionsRef.current[widgetId] = { x: generatedLayout.x, y: generatedLayout.y };
          return;
        }
        
        // Skip if we already have a position for this widget
        if (widgetPositionsRef.current[widgetId]) {
          return;
        }
        
        // Try to load position from localStorage first
        let position = null;
        try {
          const storageKey = `widget-position-${widgetId}`;
          const savedPosition = localStorage.getItem(storageKey);
          if (savedPosition) {
            const positionData = JSON.parse(savedPosition);
            position = { x: positionData.x, y: positionData.y };
            console.log('Restored widget position from localStorage:', widgetId, position);
          }
        } catch (error) {
          console.warn('Failed to load saved position for widget:', widgetId, error);
        }
        
        // If no saved position, use default position - arrange in a more organic, free-form layout
        if (!position) {
          const angle = (idx / childArray.length) * 2 * Math.PI;
          const radius = 200 + (idx % 3) * 100;
          const centerX = window.innerWidth / 2 - 150; // Center roughly, accounting for widget width
          const centerY = window.innerHeight / 2 - 150; // Center roughly, accounting for widget height
          
          position = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
          };
        }
        
        widgetPositionsRef.current[widgetId] = position;
      });
      
      // Set initial positions directly on DOM elements after a short delay
      setTimeout(() => {
        Object.entries(widgetPositionsRef.current).forEach(([widgetId, position]) => {
          const element = document.getElementById(`widget-${widgetId}`);
          if (element && !generatedLayouts.has(widgetId)) {
            // Position directly using style for immediate effect
            element.style.left = `${position.x}px`;
            element.style.top = `${position.y}px`;
            
            // Ensure resize handle is properly attached
            const resizeHandle = element.querySelector('.resize-handle');
            if (resizeHandle) {
              // Remove any existing event listeners to prevent duplicates
              const newResizeHandle = resizeHandle.cloneNode(true);
              resizeHandle.parentNode?.replaceChild(newResizeHandle, resizeHandle);
              
              // Add event listener to the new resize handle
              newResizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                handleResizeStart(e as any, widgetId);
              });
            }
          }
        });
        
      }, 100);
    }
  }, [childArray, widgetSizes, generatedLayouts]);

  const handleResizeStart = useCallback((e: React.MouseEvent, widgetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = document.getElementById(`widget-${widgetId}`);
    if (!element) return;
    
    const widgetSize = generatedLayouts.get(widgetId) ?? widgetSizes.find(size => size.id === widgetId);
    if (!widgetSize) return;
    
    resizingWidget.current = {
      id: widgetId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: widgetSize.width,
      startHeight: widgetSize.height,
      element
    };
    
    // Add class to body to prevent text selection during resize
    document.body.classList.add('resizing');
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [widgetSizes, generatedLayouts]);

  const handleDragStart = useCallback((e: React.MouseEvent, widgetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = document.getElementById(`widget-${widgetId}`);
    if (!element) return;
    
    const position = generatedLayouts.get(widgetId) ?? widgetPositionsRef.current[widgetId] ?? { x: 0, y: 0 };
    
    draggingWidget.current = {
      id: widgetId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.x,
      startTop: position.y,
      element
    };
    
    // Add class to body to prevent text selection during drag
    document.body.classList.add('dragging');
    
    // Add dragging class to widget for visual feedback
    element.classList.add('dragging');
    
    // Bring to front
    element.style.zIndex = '1000';
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [generatedLayouts]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingWidget.current) return;

    const { startX, startY, startWidth, startHeight, element } = resizingWidget.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Get the current zoom level from the canvas container
    const zoomLevel = getCanvasZoomLevel();

    // Adjust delta for zoom level to make resizing feel consistent
    // Use a more robust zoom adjustment
    const effectiveZoomLevel = zoomLevel > 0 ? zoomLevel : 1;
    const adjustedDeltaX = deltaX / effectiveZoomLevel;
    const adjustedDeltaY = deltaY / effectiveZoomLevel;

    // Set minimum size based on zoom level
    const minSize = effectiveZoomLevel < 1 ? 150 : 200;
    const newWidth = Math.max(minSize, startWidth + adjustedDeltaX);
    const newHeight = Math.max(minSize, startHeight + adjustedDeltaY);

    // Update size directly on DOM element for immediate feedback
    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;

    // Update state for persistence
    setWidgetSizes(prev =>
      prev.map(size =>
        size.id === resizingWidget.current?.id
          ? { ...size, width: newWidth, height: newHeight }
          : size
      )
    );
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!draggingWidget.current) return;

    const { startX, startY, startLeft, startTop, element, id } = draggingWidget.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Get the current zoom level from the canvas container
    const zoomLevel = getCanvasZoomLevel();
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;

    // Adjust delta for zoom level to make movement feel natural
    // Use a more robust zoom adjustment
    const effectiveZoomLevel = zoomLevel > 0 ? zoomLevel : 1;
    const adjustedDeltaX = deltaX / effectiveZoomLevel;
    const adjustedDeltaY = deltaY / effectiveZoomLevel;

    let newLeft = startLeft + adjustedDeltaX;
    let newTop = startTop + adjustedDeltaY;

    // Get viewport dimensions in logical coordinates (accounting for zoom)
    const canvasRect = canvasContainer?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    const viewportWidth = Math.max(canvasRect.width / effectiveZoomLevel, window.innerWidth);
    const viewportHeight = Math.max(canvasRect.height / effectiveZoomLevel, window.innerHeight);
    
    // Get widget dimensions in logical coordinates
    const widgetSize = generatedLayouts.get(id) ?? widgetSizes.find(size => size.id === id);
    const elementWidth = widgetSize?.width || 300;
    const elementHeight = widgetSize?.height || 300;

    // Allow movement across entire viewport with generous padding for zoomed views
    const padding = effectiveZoomLevel < 1 ? 200 : 50;
    const minLeft = -padding;
    const maxLeft = viewportWidth - elementWidth + padding;
    const minTop = -padding;
    const maxTop = viewportHeight - elementHeight + padding;

    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
    newTop = Math.max(minTop, Math.min(maxTop, newTop));

    // Update position directly on DOM element for immediate feedback
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;

    // Also update our ref to keep track of the position
    widgetPositionsRef.current[id] = { x: newLeft, y: newTop };
  }, [widgetSizes, generatedLayouts]);

  const handleResizeEnd = useCallback(() => {
    if (!resizingWidget.current) return;
    
    const { element, id, startWidth, startHeight } = resizingWidget.current;
    resizingWidget.current = null;
    
    // Remove class from body
    document.body.classList.remove('resizing');
    
    // Remove resizing class and restore normal state
    element.classList.remove('resizing');
    element.style.zIndex = '';
    
    // Get the final dimensions
    const computedStyle = window.getComputedStyle(element);
    const finalWidth = parseInt(computedStyle.width, 10) || startWidth;
    const finalHeight = parseInt(computedStyle.height, 10) || startHeight;
    
    // Update the size in state
    setWidgetSizes(prev =>
      prev.map(size =>
        size.id === id
          ? { ...size, width: finalWidth, height: finalHeight }
          : size
      )
    );
    
    const generatedLayout = generatedBlocks?.find(block => block.id === id)?.layout;
    if (generatedLayout) {
      onGeneratedLayoutChange?.(id, { x: generatedLayout.x, y: generatedLayout.y, width: finalWidth, height: finalHeight });
    } else {
      // Preserve the legacy widget storage path.
      try {
        localStorage.setItem(`widget-size-${id}`, JSON.stringify({ width: finalWidth, height: finalHeight, timestamp: Date.now() }));
      } catch (error) {
        console.warn('Failed to save widget size:', error);
      }
    }
    
    // Add smooth transition back to normal state
    element.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    
    // Remove transition after animation completes
    setTimeout(() => {
      element.style.transition = '';
    }, 300);
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove, generatedBlocks, onGeneratedLayoutChange]);

  const handleDragEnd = useCallback(() => {
    if (!draggingWidget.current) return;
    
    const { element, id } = draggingWidget.current;
    
    // Get the final position from the element
    const computedStyle = window.getComputedStyle(element);
    const finalX = parseInt(computedStyle.left, 10) || 0;
    const finalY = parseInt(computedStyle.top, 10) || 0;
    
    // Update our ref with the final position
    widgetPositionsRef.current[id] = { x: finalX, y: finalY };
    
    const generatedLayout = generatedBlocks?.find(block => block.id === id)?.layout;
    if (generatedLayout) {
      onGeneratedLayoutChange?.(id, { x: finalX, y: finalY, width: generatedLayout.width, height: generatedLayout.height });
    } else {
      // Preserve the legacy widget storage path.
      try {
        localStorage.setItem(`widget-position-${id}`, JSON.stringify({ x: finalX, y: finalY, timestamp: Date.now() }));
      } catch (error) {
        console.warn('Failed to save widget position:', error);
      }
    }
    
    draggingWidget.current = null;
    
    // Remove class from body to restore text selection
    document.body.classList.remove('dragging');
    
    // Remove dragging class and restore normal state
    element.classList.remove('dragging');
    element.style.zIndex = '';
    
    // Add smooth transition back to normal state
    element.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    
    // Remove transition after animation completes
    setTimeout(() => {
      element.style.transition = '';
    }, 300);
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove, generatedBlocks, onGeneratedLayoutChange]);

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`free-layout-container w-full relative min-h-screen ${draggingWidget.current ? 'dragging-active' : ''}`}
      style={{ cursor: draggingWidget.current ? 'grabbing' : 'default', background: 'transparent', minHeight: generatedCanvasHeight }}
    >
      {childArray.map((child, idx) => {
        const props: any = child.props || {};
        const widgetId = props.widget?.id || props.widgetId || props['data-widget-id'] || `child-${idx}`;
        const generatedLayout = generatedLayouts.get(widgetId);
        const widgetSize = widgetSizes.find(size => size.id === widgetId);
        const isGeneratedResizing = resizingWidget.current?.id === widgetId;
        const isGeneratedDragging = draggingWidget.current?.id === widgetId;
        const widgetPosition = generatedLayout && !isGeneratedDragging
          ? generatedLayout : widgetPositionsRef.current[widgetId] || { x: 0, y: 0 };
        const isDragging = draggingWidget.current?.id === widgetId;
        
        return (
          <div
            key={widgetId}
            id={`widget-${widgetId}`}
            className={`widget-container absolute cursor-move ${isDragging ? 'dragging' : ''}`}
            style={{
              width: generatedLayout && !isGeneratedResizing ? generatedLayout.width : widgetSize?.width || 300,
              height: generatedLayout && !isGeneratedResizing ? generatedLayout.height : widgetSize?.height || 300,
              left: widgetPosition.x,
              top: widgetPosition.y,
              zIndex: isDragging ? 1000 : 1,
              transform: isDragging ? 'scale(1.05) rotate(2deg)' : 'none',
              transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
              willChange: isDragging ? 'transform' : 'auto',
              boxShadow: isDragging ? '0 20px 40px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
            onMouseDown={(e) => {
              // Only start drag if not clicking on interactive elements
              if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) {
                return;
              }
              handleDragStart(e, widgetId);
            }}
          >
            {child}
            <div
              className="resize-handle"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, widgetId);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default FreeLayoutManager;
