import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ECBasicOption } from 'echarts/types/dist/shared';
import { useTheme } from '../../../../providers/ThemeProvider';

interface ChartProps {
    dataXaxis: any;
    dataYaxis: any;
    lineColor: string;
    gardientColor: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    dataYaxis2?: any;
    lineColor2?: string;
    yAxisLabel2?: string;
    yAxis2format?: 'percent';
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
}) => {
    const chartRef = useRef<HTMLDivElement | null>(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

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
            const myChart = echarts.init(chartRef.current, isDarkMode ? 'dark' : undefined);
            
            // Resolve CSS custom properties to actual color values
            const resolvedLineColor = resolveColor(lineColor);
            const resolvedGradientColor = resolveColor(gardientColor);
            const resolvedLineColor2 = lineColor2 ? resolveColor(lineColor2) : '#5470c6';

            const option: ECBasicOption = {
                tooltip: {
                    trigger: 'axis'
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
                            color: isDarkMode ? '#ccc' : '#666',
                            fontSize: 14
                        },
                        splitLine: {
                            lineStyle: {
                                color: 'hsl(var(--border))'
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
    }, [dataXaxis, dataYaxis, xAxisLabel, yAxisLabel, lineColor, gardientColor, isDarkMode, dataYaxis2, lineColor2, yAxisLabel2, yAxis2format]);

    return (
        <div className="w-full">
            <div
                ref={chartRef}
                className={`h-[350px] w-full rounded-lg`}
            />
        </div>
    );
};

export default LineChart;