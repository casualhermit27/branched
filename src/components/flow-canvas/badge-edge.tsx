
import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { availableAIs } from '../ai-pills';

export default function BadgeEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    // data.targetModelId should be passed if there is a transition
    const modelId = data?.targetModelId;
    const targetModel = modelId ? availableAIs.find(ai => ai.id === modelId) : null;

    // Determine if we should show the badge
    const showBadge = data?.isTransition && targetModel;

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {showBadge && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'none',
                            zIndex: 10,
                        }}
                        className="flex items-center justify-center p-0.5 bg-card border border-border/50 rounded-full shadow-sm w-5 h-5"
                        title={`Switched to ${targetModel?.name}`}
                    >
                        {targetModel?.logo}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
