import React, { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
const Insights = () => {
    const dispatch = useAppDispatch();
    const chartData = useAppSelector((state) => state.swap.logsData);
    useEffect(() => {
        // dispatch(getAllLogs());
    }, []);
    return (React.createElement(React.Fragment, null));
};
export default Insights;
