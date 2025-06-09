import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../../../providers/ThemeProvider';
const LineChart = ({ dataXaxis, dataYaxis, lineColor, gardientColor, xAxisLabel, yAxisLabel, dataYaxis2, lineColor2, yAxisLabel2, yAxis2format, }) => {
    const chartRef = useRef(null);
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    useEffect(() => {
        if (chartRef.current && dataYaxis && dataYaxis.length > 0) {
            const myChart = echarts.init(chartRef.current, isDarkMode ? 'dark' : undefined);
            const option = {
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
                yAxis: [
                    {
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
                        },
                        splitLine: {
                            lineStyle: {
                                color: isDarkMode ? '#333' : '#eee'
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
                    right: dataYaxis2 ? '8%' : '4%',
                    bottom: '10%',
                    top: '10%',
                    containLabel: true
                }
            };
            if (dataYaxis2 && dataYaxis2.length > 0) {
                option.yAxis.push({
                    type: 'value',
                    name: yAxisLabel2 || '',
                    position: 'right',
                    axisLabel: {
                        color: isDarkMode ? '#ccc' : '#666',
                        formatter: yAxis2format === 'percent' ? '{value} %' : '{value}',
                    },
                    nameLocation: 'middle',
                    nameGap: 45,
                    nameTextStyle: {
                        color: isDarkMode ? '#ccc' : '#666',
                        fontSize: 14
                    },
                    splitLine: {
                        show: false
                    }
                });
                option.series.push({
                    name: yAxisLabel2,
                    data: dataYaxis2,
                    type: 'line',
                    smooth: true,
                    yAxisIndex: 1,
                    itemStyle: {
                        color: lineColor2 || '#5470c6'
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
    return (React.createElement("div", { className: "w-full" },
        React.createElement("div", { ref: chartRef, className: `h-[350px] w-full rounded-lg` })));
};
export default LineChart;
