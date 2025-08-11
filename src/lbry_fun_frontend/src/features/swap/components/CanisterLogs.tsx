import React, { useState } from 'react';
import { useCanisterLogs, useProcessedLogs } from '@/hooks/useCanisterLogs';
import { CanisterType } from '@/actors/canisterActorFactory';
import { Button } from '@/lib/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/lib/components/dialog';
import { Skeleton } from '@/lib/components/skeleton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faChevronLeft, faChevronRight, faRotate, faFilter } from '@fortawesome/free-solid-svg-icons';

interface CanisterLogsProps {
  canisterId: string;
  canisterName: string;
  canisterType: CanisterType;
}

export const CanisterLogs: React.FC<CanisterLogsProps> = ({
  canisterId,
  canisterName,
  canisterType
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'info' | 'error'>('all');
  
  const {
    logs,
    loading,
    error,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    refresh
  } = useCanisterLogs(canisterId, canisterType, {
    pageSize: 20,
    autoRefreshInterval: 0 // Manual refresh only
  });

  const processedLogs = useProcessedLogs(logs);
  
  // Filter logs based on selected type
  const filteredLogs = processedLogs.filter(log => {
    if (filterType === 'all') return true;
    if (filterType === 'info') return log.isInfo;
    if (filterType === 'error') return log.isError;
    return true;
  });

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        scale="sm"
        onClick={() => setIsOpen(true)}
        className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
      >
        <FontAwesomeIcon icon={faTerminal} className="mr-2" />
        View Logs
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-black border border-white/30 font-mono text-sm p-3 max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-white mb-1 text-sm uppercase">
              <span className="text-pink-500">&gt;</span> {canisterName} LOGS
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Controls */}
            <div className=" mb-4">
              <div className="terminal-row justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    variant={filterType === 'all' ? 'primary' : 'outline'}
                    scale="sm"
                    onClick={() => setFilterType('all')}
                  >
                    ALL
                  </Button>
                  <Button
                    variant={filterType === 'info' ? 'primary' : 'outline'}
                    scale="sm"
                    onClick={() => setFilterType('info')}
                    className={filterType === 'info' ? 'text-green-500' : ''}
                  >
                    INFO
                  </Button>
                  <Button
                    variant={filterType === 'error' ? 'primary' : 'outline'}
                    scale="sm"
                    onClick={() => setFilterType('error')}
                    className={filterType === 'error' ? 'text-red-400' : ''}
                  >
                    ERROR
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  scale="sm"
                  onClick={refresh}
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faRotate} className={loading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>

            <div className="border-b border-white/20 my-3 mb-4" />

            {/* Logs Display */}
            <div className="flex-1 overflow-y-auto ">
              {loading && !logs ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-red-400 text-center py-8">
                  ERROR: {error}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-lime-500/50">
                  No logs found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log) => (
                    <LogEntry key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {logs && totalPages > 1 && (
              <>
                <div className="border-b border-white/20 my-3 mt-4 mb-4" />
                <div className="">
                  <div className="terminal-row justify-between items-center">
                    <Button
                      variant="outline"
                      scale="sm"
                      onClick={prevPage}
                      disabled={currentPage === 1}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span>PAGE</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={handlePageInputChange}
                        className="bg-transparent text-white font-mono text-sm placeholder-gray-600 focus:outline-none w-full w-16 text-center"
                      />
                      <span>OF {totalPages}</span>
                    </div>
                    
                    <Button
                      variant="outline"
                      scale="sm"
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Individual log entry component
interface ProcessedLog {
  id: string;
  timestamp: string;
  function: string;
  isError: boolean;
  isInfo: boolean;
  message: string;
  logType: unknown;
}

const LogEntry: React.FC<{ log: ProcessedLog }> = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div 
      className={` p-3 cursor-pointer transition-all ${
        log.isError ? 'border-red-500/50 hover:border-red-500' : 'hover:border-lime-500'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="terminal-row justify-between items-start">
        <div className="flex-1">
          <div className="terminal-row gap-4 mb-1">
            <span className={`font-bold ${log.isError ? 'text-red-500' : 'text-lime-500'}`}>
              [{log.isError ? 'ERROR' : 'INFO'}]
            </span>
            <span className="text-xs opacity-70">{log.timestamp}</span>
          </div>
          <div className="font-mono text-sm">
            <span className="text-pink-500">{log.function}()</span>
          </div>
          {isExpanded && (
            <>
              <div className="border-b border-dotted border-white/30 my-2" />
              <div className="text-sm space-y-1">
                <div><span className="text-lime-500">Message:</span> {log.message}</div>
                <div><span className="text-lime-500">Caller:</span> <span className="font-mono text-xs">{log.caller}</span></div>
                <div><span className="text-lime-500">Log ID:</span> {log.id}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};