import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ECBasicOption } from 'echarts/types/dist/shared';

interface ChartProps {
    dataXaxis: (string | number)[];
    dataYaxis: (string | number)[];
    lineColor: string;
    gardientColor: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    dataYaxis2?: (string | number)[];
    lineColor2?: string;
    yAxisLabel2?: string;
    yAxis2format?: 'percent';
    currentPositionX?: number | string;
    showCurrentPosition?: boolean;
    currentPositionLabel?: string;
}

const LineChart: React.FC<ChartProps> = ({
    dataXaxis,
    dataYaxis,
    lineColor,
    gardientColor,
    xAxisLabel,
    yAxisLabel,
    dataYaxis2,
    lineColor2,
    yAxisLabel2,
    yAxis2format,
    currentPositionX,
    showCurrentPosition = false,
    currentPositionLabel,
}) => {
    const chartRef = useRef<HTMLDivElement | null>(null);

    // Helper function to resolve CSS custom properties
    const resolveColor = (colorString: string): string => {
        if (typeof document === 'undefined') return colorString;
        
        const tempDiv = document.createElement('div');
        tempDiv.style.color = colorString;
        document.body.appendChild(tempDiv);
        const computedColor = getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);
        return computedColor || colorString;
    };

    useEffect(() => {
        if (chartRef.current && dataYaxis && dataYaxis.length > 0) {
            const myChart = echarts.init(chartRef.current);
            
            // Resolve CSS custom properties to actual color values
            const resolvedLineColor = resolveColor(lineColor);
            const resolvedGradientColor = resolveColor(gardientColor);
            const resolvedLineColor2 = lineColor2 ? resolveColor(lineColor2) : '#5470c6';

            const option: ECBasicOption = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    textStyle: {
                        color: '#fff'
                    }
                },
                xAxis: {
                    type: 'category',
                    data: dataXaxis,
                    axisLabel: {
                        color: 'hsl(var(--muted-foreground))'
                    },
                    name: xAxisLabel,
                    nameLocation: 'middle',
                    nameGap: 35,
                    nameTextStyle: {
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: 14
                    }
                },
                yAxis: [
                    {
                        type: 'value',
                        axisLabel: {
                            color: 'hsl(var(--muted-foreground))'
                        },
                        name: yAxisLabel,
                        nameLocation: 'middle',
                        nameGap: 60,
                        nameTextStyle: {
                            color: '#ccc',
                            fontSize: 14
                        },
                        splitLine: {
                            lineStyle: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                type: 'dashed'
                            }
                        }
                    }
                ],
                series: [
                    {
                        name: yAxisLabel,
                        data: dataYaxis,
                        type: 'line',
                        smooth: true,
                        itemStyle: {
                            color: resolvedLineColor
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: resolvedGradientColor },
                                { 
                                    offset: 1, 
                                    color: resolveColor('hsl(var(--border) / 0.1)')
                                }
                            ])
                        }
                    }
                ],
                grid: {
                    left: '8%',
                    right: dataYaxis2 ? '8%' : '4%',
                    bottom: '10%',
                    top: '10%',
                    containLabel: true
                }
            };
            
            // Add current position marker if requested
            if (showCurrentPosition && currentPositionX !== undefined && dataXaxis.length > 0) {
                // Ensure position is within data bounds
                let clampedPosition = currentPositionX;
                
                // For numeric x-axis data, clamp the position
                if (typeof dataXaxis[0] === 'number') {
                    const numericXaxis = dataXaxis.map(x => Number(x));
                    const minX = Math.min(...numericXaxis);
                    const maxX = Math.max(...numericXaxis);
                    const numericPosition = Number(currentPositionX);
                    
                    if (!isNaN(numericPosition)) {
                        clampedPosition = Math.max(minX, Math.min(maxX, numericPosition));
                    }
                }
                
                const markLineData = [{
                    xAxis: clampedPosition,
                    lineStyle: {
                        color: '#00ff00',
                        type: 'dashed',
                        width: 2,
                        opacity: 0.8
                    },
                    label: {
                        show: true,
                        formatter: currentPositionLabel || '▼ We are here',
                        position: 'end',
                        color: '#00ff00',
                        fontSize: 12,
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: [6, 10],
                        borderRadius: 4,
                        borderColor: '#00ff00',
                        borderWidth: 1,
                        shadowColor: '#00ff00',
                        shadowBlur: 10
                    }
                }];
                
                // Add mark line to the first series
                (option.series as any)[0].markLine = {
                    silent: true,
                    symbol: ['none', 'none'],
                    data: markLineData
                };
            }

            if (dataYaxis2 && dataYaxis2.length > 0) {
                (option.yAxis as echarts.EChartsCoreOption['yAxis'][]).push({
                    type: 'value',
                    name: yAxisLabel2 || '',
                    position: 'right',
                    axisLabel: {
                        color: 'hsl(var(--muted-foreground))',
                        formatter: yAxis2format === 'percent' ? '{value} %' : '{value}',
                    },
                    nameLocation: 'middle',
                    nameGap: 45,
                    nameTextStyle: {
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: 14
                    },
                    splitLine: {
                        show: false
                    }
                });

                (option.series as echarts.EChartsCoreOption['series'][]).push({
                    name: yAxisLabel2,
                    data: dataYaxis2,
                    type: 'line',
                    smooth: true,
                    yAxisIndex: 1,
                    itemStyle: {
                        color: resolvedLineColor2
                    },
                });
            }

            myChart.setOption(option);

            const handleResize = () => {
                myChart.resize();
            };
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                myChart.dispose();
            };
        }
    }, [dataXaxis, dataYaxis, xAxisLabel, yAxisLabel, lineColor, gardientColor, dataYaxis2, lineColor2, yAxisLabel2, yAxis2format, currentPositionX, showCurrentPosition, currentPositionLabel]);

    return (
        <div className="w-full">
            <div
                ref={chartRef}
                className={`h-[350px] w-full rounded-lg`}
            />
        </div>
    );
};

export default React.memo(LineChart);