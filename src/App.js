import React, { useState, useRef } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import html2canvas from 'html2canvas';
import 'reactflow/dist/style.css';
import './index.css';

export default function ClockSimulator() {
  const [numProcesses, setNumProcesses] = useState(0);
  const [eventInputs, setEventInputs] = useState([]);
  const [messageCount, setMessageCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [output, setOutput] = useState('');
  const [lamportElements, setLamportElements] = useState([]);
  const [vectorElements, setVectorElements] = useState([]);
  const lamportRef = useRef();
  const vectorRef = useRef();

  const handleEventInput = (index, value) => {
    const updated = [...eventInputs];
    updated[index] = value;
    setEventInputs(updated);
  };

  const handleMessageChange = (index, value) => {
    const updated = [...messages];
    updated[index] = value;
    setMessages(updated);
  };

  const parseInput = () => {
    const processEvents = {};
    const eventMap = {};
    const reverseMap = {};
    const events = [];

    eventInputs.forEach((line, i) => {
      const names = line.split(',').map(e => e.trim());
      processEvents[i] = names;
      events.push(names.length);
      names.forEach((name, j) => {
        eventMap[name] = [i, j];
        reverseMap[`${i},${j}`] = name;
      });
    });

    const indexedMessages = messages.map(msg => {
      const [s, r] = msg.split(',').map(e => e.trim());
      return [eventMap[s], eventMap[r]];
    });

    return { numProcesses, events, processEvents, eventMap, reverseMap, indexedMessages };
  };

  const computeLamport = (n, events, messages) => {
    const clock = events.map(count => Array(count).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < events[i]; j++) {
        clock[i][j] = j === 0 ? 1 : clock[i][j - 1] + 1;
      }
    }
    for (const [[sp, se], [rp, re]] of messages) {
      const send = clock[sp][se];
      if (clock[rp][re] <= send) {
        const delta = send + 1 - clock[rp][re];
        for (let i = re; i < events[rp]; i++) {
          clock[rp][i] += delta;
        }
      }
    }
    return clock;
  };

  const computeVector = (n, events, messages) => {
    const vc = events.map((count, i) => Array.from({ length: count }, () => Array(n).fill(0)));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < events[i]; j++) {
        if (j === 0) vc[i][j][i] = 1;
        else {
          vc[i][j] = [...vc[i][j - 1]];
          vc[i][j][i]++;
        }
      }
    }
    for (const [[sp, se], [rp, re]] of messages) {
      const send = vc[sp][se];
      if (re === 0) {
        const merged = [...send];
        merged[rp]++;
        vc[rp][re] = merged;
      } else {
        const base = [...vc[rp][re - 1]];
        base[rp]++;
        const merged = base.map((v, i) => Math.max(v, send[i]));
        vc[rp][re] = merged;
      }
      for (let i = re + 1; i < events[rp]; i++) {
        vc[rp][i] = [...vc[rp][i - 1]];
        vc[rp][i][rp]++;
      }
    }
    return vc;
  };

  const buildDiagram = (n, events, indexedMessages, reverseMap, clockMatrix, isVector) => {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < events[i]; j++) {
      const id = `${i}-${j}`;
      const label = `${reverseMap[`${i},${j}`]}\n${isVector ? 'V' : 'L'}=${isVector ? `[${clockMatrix[i][j].join(',')}]` : clockMatrix[i][j]}`;
      nodes.push({
        id,
        data: { label },
        position: { x: j * 150 + 100, y: i * 100 + 60 },
        style: {
          padding: 10,
          border: '1px solid #999',
          borderRadius: 6,
          background: '#f0f9ff',
          fontSize: 12,
          width: 60,
          textAlign: 'center'
        }
      });
    }
  }

  indexedMessages.forEach(([[sp, se], [rp, re]], idx) => {
    edges.push({
      id: `e${isVector ? 'v' : 'l'}${idx}`,
      source: `${sp}-${se}`,
      target: `${rp}-${re}`,
      animated: true,
      style: { stroke: '#1d4ed8', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed',
        color: '#1d4ed8'
      }
    });
  });

  return [...nodes, ...edges];
};

const handleCompute = () => {
  try {
    const { numProcesses: n, events, processEvents, indexedMessages, reverseMap } = parseInput();
    const lamport = computeLamport(n, events, indexedMessages);
    const vector = computeVector(n, events, indexedMessages);

    const result = [
      'Lamport Clock:',
      ...lamport.flatMap((row, i) => row.map((val, j) => `${reverseMap[`${i},${j}`]}: ${val}`)),
      '',
      'Vector Clock:',
      ...vector.flatMap((row, i) => row.map((val, j) => `${reverseMap[`${i},${j}`]}: [${val.join(',')}]`))
    ].join('\n');
    setOutput(result);

    setLamportElements(buildDiagram(n, events, indexedMessages, reverseMap, lamport, false));
    setVectorElements(buildDiagram(n, events, indexedMessages, reverseMap, vector, true));
  } catch (e) {
    setOutput("❌ Error: Check event names or message formatting.");
  }
};


  const exportDiagram = async (ref, type = 'png') => {
    const canvas = await html2canvas(ref.current);
    const link = document.createElement('a');
    link.download = `diagram.${type}`;
    link.href = canvas.toDataURL(`image/${type}`);
    link.click();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">Lamport & Vector Clock Visualizer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <label className="font-semibold">🔢 Number of Processes:</label>
          <input
            type="number"
            className="border w-full p-2 mt-1 rounded"
            value={numProcesses === 0 ? '' : numProcesses}
            onChange={e => {
              const val = e.target.value;
              if (val === '') {
                setNumProcesses(0);
                setEventInputs([]);
                return;
              }
              const n = parseInt(val);
              if (!isNaN(n)) {
                if (n === 0) {
                  alert("⚠️ Number of processes cannot be zero.");
                  return;
                }
                setNumProcesses(n);
                setEventInputs(Array(n).fill(''));
              }
            }}
          />

          {eventInputs.map((val, i) => (
            <div key={i} className="mt-4">
              <label className="font-semibold">🧩 P{i} Events (comma-separated e.g a,b,c):</label>
              <input
                className="border w-full p-2 rounded mt-1"
                value={val}
                onChange={e => handleEventInput(i, e.target.value)}
              />
            </div>
          ))}
          <div className="mt-4">
            <label className="font-semibold">✉️ Total Messages(Number of Messaging Event):</label>
            <input
              type="number"
              className="border w-full p-2 rounded mt-1"
              value={messageCount === 0 ? '' : messageCount}
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  setMessageCount(0);
                  setMessages([]);
                  return;
                }
                const count = parseInt(val);
                if (!isNaN(count)) {
                  if (count === 0) {
                    alert("⚠️ Total messages cannot be zero.");
                    return;
                  }
                  setMessageCount(count);
                  setMessages(Array(count).fill(''));
                }
              }}
            />

          </div>
          {messages.map((msg, i) => (
            <div key={i} className="mt-2">
              <label className="font-semibold">🔗 Message {i + 1} (e.g., a,f where a is sending event and f is recieving event):</label>
              <input
                className="border w-full p-2 rounded mt-1"
                value={msg}
                onChange={e => handleMessageChange(i, e.target.value)}
              />
            </div>
          ))}
          <button
            className="mt-6 bg-blue-600 text-white px-4 py-2 w-full rounded shadow hover:bg-blue-700"
            onClick={handleCompute}
          >
            ▶️ Compute
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <label className="font-semibold mb-1">📋 Output:</label>
          <pre className="bg-gray-100 p-3 mt-2 h-96 overflow-auto text-sm">{output}</pre>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between mb-2">
            <h2 className="font-bold text-blue-600">Lamport Clock Diagram</h2>
            <button
              onClick={() => exportDiagram(lamportRef)}
              className="text-sm bg-slate-300 px-3 py-1 rounded hover:bg-slate-400"
            >
              Export PNG
            </button>
          </div>
          <div className="h-[500px] bg-white rounded shadow" ref={lamportRef}>
            <ReactFlow nodes={lamportElements.filter(e => e.data)} edges={lamportElements.filter(e => e.source)} fitView>
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <h2 className="font-bold text-green-600">Vector Clock Diagram</h2>
            <button
              onClick={() => exportDiagram(vectorRef)}
              className="text-sm bg-slate-300 px-3 py-1 rounded hover:bg-slate-400"
            >
              Export PNG
            </button>
          </div>
          <div className="h-[500px] bg-white rounded shadow" ref={vectorRef}>
            <ReactFlow nodes={vectorElements.filter(e => e.data)} edges={vectorElements.filter(e => e.source)} fitView>
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}
