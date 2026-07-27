import { useState, useEffect } from 'react';
/**
 * Hook that returns a formatted elapsed time string, updating every second.
 *
 * @param startTime - Unix timestamp in ms when the operation started, or null
 * @param isRunning - Whether to actively update the timer
 * @returns Formatted duration string (e.g., "23s", "1m 05s"), or '' when not running
 */
export function useElapsedTime(startTime, isRunning) {
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        if (!startTime || !isRunning) {
            setElapsed('');
            return;
        }
        const update = () => {
            const ms = Date.now() - startTime;
            const totalSec = Math.floor(ms / 1000);
            if (totalSec < 60) {
                setElapsed(`${totalSec}s`);
            }
            else {
                const min = Math.floor(totalSec / 60);
                const sec = totalSec % 60;
                setElapsed(`${min}m ${String(sec).padStart(2, '0')}s`);
            }
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [startTime, isRunning]);
    return elapsed;
}
