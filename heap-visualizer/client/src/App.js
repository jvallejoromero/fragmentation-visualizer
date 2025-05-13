import './App.css';
import React, {useState, useEffect, useRef} from 'react';
import {io} from 'socket.io-client';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, Tooltip, LabelList, Cell, YAxis,
  LineChart, CartesianGrid, Line,
} from 'recharts';
import Slider from "@mui/material/Slider";
import { ChevronLeft, ChevronRight } from 'lucide-react';

const socket = io('http://10.173.60.41:3001');

/**
 * @typedef {Object} Chunk
 * @property {number} size
 * @property {boolean} allocated
 *
 * @typedef {Chunk[]} Frame
 */

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

function App() {
  const isMobile = useIsMobile(600);

  const [metrics, setMetrics] = useState({ holes:0, frag:0, totalFree: 0, heapSize: 0 });

  /** @type {[Frame, React.Dispatch<Frame>]} */
  const [current, setCurrent] = useState([]);

  /** @type {[Frame[], React.Dispatch<Frame[]>]} */
  const [history, setHistory] = useState([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(null);

  const [syscallsHistory, setSyscallsHistory] = useState([]);  

  useEffect(() => {
    const handleSyscalls = ({snapshotId, allocs, frees}) => {
      const time = new Date().toLocaleTimeString();
      const newPoint = {time, allocs, frees}
      console.log("snap id", snapshotId)
      if (snapshotId === 1) {
        setSyscallsHistory([newPoint]);
      } else {
        setSyscallsHistory((old) => {
          const next = [...old, newPoint];
          return next.length > 300 ? next.slice(-300) : next;
        });
      }
    }

    const handleSnapshot = ({snapshotId, chunks}) => {
      // reset selected frame if new process
      if (snapshotId === 1) {
        setHistory([]);
        setSelectedFrameIndex(null);
        console.log('reset');
      }

      setCurrent(chunks);  
      setHistory((h) => {
        // h is the previous Frame[] array 
        return [...h, chunks];
      });
    }
    socket.on('connect', () => console.log('⚡ socket connected:', socket.id));
    socket.on('connect_error', err => console.error('❌ connect_error:', err));
    socket.on('snapshot', handleSnapshot);
    socket.on('syscalls', handleSyscalls);

    return () => {
      socket.off('snapshot', handleSnapshot);
      socket.off('syscalls', handleSyscalls);
    };
  }, []);


  // update chart when selectedFrameIndex or history changes
  useEffect(() => {
    if (selectedFrameIndex === null) {
      // show the latest
      setCurrent(history[history.length - 1] || []);
    } else {
      setCurrent(history[selectedFrameIndex]);
    }
  }, [selectedFrameIndex]);

  // decide which frame to show
  const displayFrame = selectedFrameIndex === null ? current : history[selectedFrameIndex];
  const displayIndex = selectedFrameIndex ?? (history.length - 1); 

  // compute metrics when displayFrame changes
  useEffect(() => {
    const free = displayFrame.filter(c => !c.allocated).map(c => c.size);
    const totalFree = free.reduce((a,b) => a+b, 0);
    const largest = free.length ? Math.max(...free) : 0;
    const frag = totalFree > 0 ? (1 - (largest/totalFree)) : 0;
    const heapSize = displayFrame.reduce((sum, chunk) => sum + chunk.size, 0);

    setMetrics({holes: free.length, frag, totalFree, heapSize});
  }, [displayFrame]);


  // build chart data
  let pos = 0;
  const chartData = displayFrame.map((chunk, index) => {
    const entry = {x: pos, width: chunk.size, allocated: chunk.allocated};
    pos += chunk.size;
    return entry;    
  });

  const disableBack = history.length === 0 || displayIndex <= 0;
  const disableForward = history.length === 0 || displayIndex >= history.length - 1;


  // set end index when chartData changes
  useEffect(() => {
    if (!chartData) return;
    setEndIndex(chartData.length);
  }, [chartData.length]);
  
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(chartData?.length);


  return (
    <div style={styles.root}>
      <div style={styles.header}>
        {/* Header */}
        <div style={styles.headerLeft}>
          <div>CS3750</div>
          <div style={styles.headerSubtitle}>Presentation Demo</div>
        </div>
        <div style={styles.headerRight}>
          <div>Team Members</div>
          <div style={styles.headerSubtitle}>Jonathan Vallejo</div>
          <div style={styles.headerSubtitle}>Placeholder</div>
        </div>
      </div>

      {/* Content */}
      <div 
        style={{
          ...styles.content,
          flexDirection: isMobile ? 'column' : 'row'
        }}
      >
        <div style={styles.memDiv}>
          <div style={styles.contentSubtitle}>System Calls</div>
          <p style={{ color: 'white', textAlign: 'center', fontSize: 12, paddingBottom: 50 }}>malloc/free over time</p>
          
          {(chartData.length > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={syscallsHistory}>
                <CartesianGrid 
                  stroke='white'
                  strokeDasharray="3 3" 
                />
                <XAxis 
                  dataKey="time" 
                  axisLine={{ stroke: 'white' }}
                  tick={{ fill: 'white', fontSize: 10 }} 
                  tickLine={true}
                />
                <YAxis 
                  allowDecimals={false} 
                  axisLine={{ stroke: 'white' }}
                  tick={{ fill: 'white' }} 
                />
                <Tooltip 
                  itemStyle={{
                    color: "#000"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="allocs"
                  name="Allocations"
                  stroke="red"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="frees"
                  name="Deallocations"
                  stroke="lime"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
              <div style={{ color: 'white', fontSize: 14, textAlign: 'center' }}>
                Waiting for data…
              </div>
          )}
        </div>

        <div style={styles.fragDiv}>

          {!disableBack && (
            <div style={styles.chartButtonLeft}>
              <button
                disabled={disableBack}
                onClick={() => {
                  setSelectedFrameIndex(idx => {
                    console.log("index: ", idx);
                    if (idx === null) return history.length - 2;
                    return Math.max(0, idx - 1);
                  });
                }}
                aria-label="Back"
                className="nav-button"
              >
                <ChevronLeft size={28} />
              </button>
            </div>
          )}

          {!disableForward && (
            <div style={styles.chartButtonRight}>
              <button
                disabled={disableForward}
                onClick={() => {
                  setSelectedFrameIndex(idx => {
                    console.log("index: ", idx);
                    if (idx !== null) {
                      return Math.min(history.length - 1, idx + 1);
                    }
                    return null;
                  })
                }}
                aria-label="Forward"
                className="nav-button"
              >
                <ChevronRight size={28} />
              </button>
            </div>
          )}
        
          <div style={styles.contentSubtitle}>Fragmentation</div>
          <p style={{color: 'white', textAlign: 'center', fontSize: 12}}>Holes: {metrics.holes} | Fragmentation: {(metrics.frag*100).toFixed(1)}%</p>
          <p style={{color: 'white', textAlign: 'center', fontSize: 12}}>Total Free: {metrics.totalFree <= 0 ? 0 : metrics.totalFree}/{metrics.heapSize <= 0 ? 0 : metrics.heapSize} bytes</p>
          
          {(chartData.length) > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={chartData.slice(startIndex, endIndex)}
                layout="horizontal"
              >
                <YAxis
                  type="number"
                  domain={[0, 'dataMax * 0.95']}
                  hide
                />
                <XAxis dataKey="x" hide />
                <Tooltip
                  itemStyle={{
                    color: "#000"
                  }}
                  labelFormatter={() => ''}
                  formatter={(value, name) => {
                    if (name === 'width') {
                      return [`Size: ${value}`, null];
                    }
                    if (name === 'allocated') {
                      return [value ? 'Allocated' : 'Free', null];
                    }
                    return [value, name];
                  }}
                />

                {/* invisible bar just so Tooltip sees `allocated` */}
                <Bar dataKey="allocated" fill="transparent" />
                <Bar
                  dataKey="width"
                  isAnimationActive={true}
                >
                  <LabelList
                    dataKey="allocated"
                    position="insideTop"
                    formatter={v => v ? '█' : ' '}
                  />
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.allocated ? 'red' : 'lime'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
              <div style={{ color: 'white', fontSize: 14, paddingTop: 25, textAlign: 'center' }}>
                Waiting for data…
              </div>
          )}
          {chartData?.length > 30 && (
            <div style={styles.sliderContainer}>
              <Slider
                value={[startIndex, endIndex]}
                min={0}
                max={Math.max(0, chartData.length - 1)}
                step={1}
                disableSwap={true}
                valueLabelDisplay="auto"  // show the current values
                onChange={(e, newValue) => {
                if (Array.isArray(newValue)) {
                  setStartIndex(newValue[0]);
                  setEndIndex(newValue[1]);
                }
                }}
                sx={{
                  color: "white",            // the color of the rail & track
                  height: 10,                   // thickness of the track
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    backgroundColor: "#000e25",   // thumb fill
                    border: "2px solid currentColor", "&:hover": {
                      boxShadow: "0 0 0 8px rgba(255, 255, 255, 0.16)"
                    }
                  },
                  '& .MuiSlider-rail': {
                    opacity: 0.5,
                    backgroundColor: "#888"
                  },'& .MuiSlider-track': {
                    border: "none"
                  }
                }}
                />
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;

 const styles = {
  root: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#000e25",
    fontFamily: `"JetBrains Mono",monospace`,
    flexDirection: "column",  
    justifyContent: "flex-start", 
    alignItems: "stretch",
  },
  header: {
    display: "flex",      
    padding: 22,
    color: "#ffffff",
    fontSize: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSubtitle: {
    fontSize: 20,
    color: "#f1f1f1",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column", 
    gap: "4px",
  },
  headerRight: {
    display: "flex",
    flexDirection: "column", 
    textAlign: "right",
    gap: "4px",
  },
  content: {
    paddingTop: 25,
    display: 'flex',
    flex: 1,
    alignItems: "stretch",
    justifyContent: 'space-evenly',
  },
  contentSubtitle: {
    fontSize: 22,
    color: "#f1f1f1",
    textAlign: "center",
  },
  fragDiv: {
    flex: 1,
    padding: 24,
    position: 'relative',
  }, 
  memDiv: {
    flex: 1,
    padding: 24,
    position: 'relative',
  },
  sliderContainer: {
    paddingTop: 12,
    paddingLeft: 24,
    paddingRight: 24,
  },
  chartButtonLeft: {
    position: 'absolute',
    top: '50%',
    left: 0,
  },
  chartButtonRight: {
    position: 'absolute',
    top: "50%",
    right: 0,
  },
 }
