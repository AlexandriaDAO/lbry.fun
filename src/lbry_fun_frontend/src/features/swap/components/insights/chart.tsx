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
}

const LineChart: React.FC<ChartProps> = ({
    dataXaxis,
    dataYaxis,
    lineColor,
    gardientColor,
    xAxisLabel,
    yAxisLabel,
}) => {
    const chartRef = useRef<HTMLDivElement | null>(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    useEffect(() => {
        if (chartRef.current && dataYaxis && dataYaxis.length > 0) {
            const myChart = echarts.init(chartRef.current, isDarkMode ? 'dark' : undefined);

            const option: ECBasicOption = {
                tooltip: {
                    trigger: 'axis'
                },
                xAxis: {
                    type: 'category',
                    data: dataXaxis,
                    axisLabel: {
                        color: isDarkMode ? '#ccc' : '#666'
                    },
                    name: xAxisLabel,
                    nameLocation: 'middle',
                    nameGap: 35,
                    nameTextStyle: {
                        color: isDarkMode ? '#ccc' : '#666',
                        fontSize: 14
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: isDarkMode ? '#ccc' : '#666'
                    },
                    name: yAxisLabel,
                    nameLocation: 'middle',
                    nameGap: 60,
                    nameTextStyle: {
                        color: isDarkMode ? '#ccc' : '#666',
                        fontSize: 14
                    }
                },
                series: [
                    {
                        data: dataYaxis,
                        type: 'line',
                        smooth: true,
                        itemStyle: {
                            color: lineColor
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: gardientColor },
                                { 
                                    offset: 1, 
                                    color: isDarkMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
                                }
                            ])
                        }
                    }
                ],
                grid: {
                    left: '8%',
                    right: '4%',
                    bottom: '10%',
                    top: '10%',
                    containLabel: true
                }
            };

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
    }, [dataXaxis, dataYaxis, xAxisLabel, yAxisLabel, lineColor, gardientColor, isDarkMode]);

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