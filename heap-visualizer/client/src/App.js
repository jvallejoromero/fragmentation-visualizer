import './App.css';
import React, {useState, useEffect} from 'react';
import {io} from 'socket.io-client';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, Tooltip, LabelList, Cell, YAxis
} from 'recharts';
import Slider from "@mui/material/Slider";

const socket = io('http://10.173.60.41:3001');

/**
 * @typedef {Object} Chunk
 * @property {number} size
 * @property {boolean} allocated
 *
 * @typedef {Chunk[]} Frame
 */


function App() {

  const [metrics, setMetrics] = useState({ holes:0, frag:0, totalFree: 0, heapSize: 0 });

  /** @type {[Frame, React.Dispatch<Frame>]} */
  const [current, setCurrent] = useState([]);

  /** @type {[Frame[], React.Dispatch<Frame[]>]} */
  const [history, setHistory] = useState([]);

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(null);


  useEffect(() => {
    socket.on('connect', () => console.log('⚡ socket connected:', socket.id));
    socket.on('connect_error', err => console.error('❌ connect_error:', err));
    socket.on('snapshot', data => {
      // data = [{size, allocated}, ...]
      console.log('got snapshot:', data);
      // setChunks(data);
      setCurrent(data);
      setHistory((h) => {
        // h is the previous Frame[] array
        return [...h, data];
      });

      // compute metrics
      const free = data.filter(c => !c.allocated).map(c => c.size);
      const totalFree = free.reduce((a,b) => a+b, 0);
      const largest = free.length ? Math.max(...free) : 0;
      const frag = totalFree > 0 ? (1 - (largest/totalFree)) : 0;
      const heapSize = data.reduce((sum, chunk) => sum + chunk.size, 0);
      
      setMetrics({holes: free.length, frag, totalFree, heapSize});
    });
  }, []);

  // decide which frame to show
  const displayFrame = selectedFrameIndex === null ? current : history[selectedFrameIndex]

  // build chart data
  let pos = 0;
  const chartData = displayFrame.map((chunk, index) => {
    const entry = {x: pos, width: chunk.size, allocated: chunk.allocated};
    pos += chunk.size;
    return entry;    
  });


  useEffect(() => {
    if (!chartData) return;
    setEndIndex(chartData.length);
  }, [current]);
  
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
      <div style={styles.content}>
        <div style={styles.memDiv}>
          <div style={styles.contentSubtitle}>Memory</div>
          <p style={{color: 'white', textAlign: 'center', fontSize: 12}}>Utilization:</p>
        </div>

        <div style={styles.fragDiv}>

        {/* <button
          onClick={() => {
            setSelectedFrameIndex(idx => {
              console.log("index: ", idx);
              if (idx === null) return history.length - 1
              return Math.max(0, idx - 1)
            });
            setCurrent(selectedFrameIndex);
            console.log("hist:", history[selectedFrameIndex]);
          }}
        >
          Back
        </button>
        <button
          onClick={() => {
            setSelectedFrameIndex(idx => {
              if (idx === null) return null
              return Math.min(history.length - 1, idx + 1)
            })
            setCurrent(selectedFrameIndex);
            console.log("hist:", history[selectedFrameIndex]);
          }}
        >
          Forward
        </button> */}

          <div style={styles.contentSubtitle}>Fragmentation</div>
          <p style={{color: 'white', textAlign: 'center', fontSize: 12}}>Holes: {metrics.holes} | Fragmentation: {(metrics.frag*100).toFixed(1)}%</p>
          <p style={{color: 'white', textAlign: 'center', fontSize: 12}}>Total Free: {metrics.totalFree <= 0 ? 0 : metrics.totalFree}/{metrics.heapSize <= 0 ? 0 : metrics.heapSize} bytes</p>
          
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
                isAnimationActive={false}
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
    fontSize: 22,
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
    flexDirection: 'row',
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
  }, 
  memDiv: {
    flex: 1,
    padding: 24,
  },
  sliderContainer: {
    paddingTop: 12,
    paddingLeft: 24,
    paddingRight: 24,
  },
 }
