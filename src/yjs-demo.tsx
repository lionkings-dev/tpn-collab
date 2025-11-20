import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
// For this initial setup, we focus on the local data structure.
// We will add a network provider (like y-websocket) in a later step.

// Generate a unique ID for new elements
const generateUniqueId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function YjsTPNBuilder() {
  // A React state to hold a stringified version of our Petri Net for display
  const [petriNetState, setPetriNetState] = useState('{}');
  
  // A ref to hold our Y.Doc instance
  const ydocRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    // 1. --- INITIAL SETUP ---
    // Create the Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 2. --- DATA STRUCTURE DEFINITION ---
    // Get a Y.Map to represent the entire Petri Net.
    // This is the root of our shared data.
    const yPetriNet = ydoc.getMap('petriNet');

    // Create the shared arrays for our TPN elements if they don't exist.
    if (!yPetriNet.has('places')) {
      yPetriNet.set('places', new Y.Array());
    }
    if (!yPetriNet.has('transitions')) {
      yPetriNet.set('transitions', new Y.Array());
    }
    if (!yPetriNet.has('arcs')) {
      yPetriNet.set('arcs', new Y.Array());
    }

    // 3. --- SYNCHRONIZATION ---
    // Function to update our React state from the Y.Doc
    const updateState = () => {
      const currentState = yPetriNet.toJSON();
      setPetriNetState(JSON.stringify(currentState, null, 2));
    };

    // Observe the petriNet map for any changes and update the UI
    yPetriNet.observeDeep(updateState);

    // Initial state load
    updateState();

    // --- CLEANUP ---
    return () => {
      yPetriNet.unobserveDeep(updateState);
      ydoc.destroy();
    };
  }, []);

  // --- FUNCTIONS TO MANIPULATE THE DATA ---

  const addPlace = () => {
    if (!ydocRef.current) return;
    const yPetriNet = ydocRef.current.getMap('petriNet');
    const yPlaces = yPetriNet.get('places') as Y.Array<Y.Map<any>>;

    const newPlace = new Y.Map();
    newPlace.set('id', generateUniqueId());
    newPlace.set('position', new Y.Map(Object.entries({ x: 100, y: 100 })));
    const label = new Y.Text();
    label.insert(0, 'New Place');
    newPlace.set('label', label);
    newPlace.set('tokens', new Y.Array());

    yPlaces.push([newPlace]);
  };

  const addTransition = () => {
    if (!ydocRef.current) return;
    const yPetriNet = ydocRef.current.getMap('petriNet');
    const yTransitions = yPetriNet.get('transitions') as Y.Array<Y.Map<any>>;

    const newTransition = new Y.Map();
    newTransition.set('id', generateUniqueId());
    newTransition.set('position', new Y.Map(Object.entries({ x: 300, y: 100 })));
    const label = new Y.Text();
    label.insert(0, 'New Transition');
    newTransition.set('label', label);
    newTransition.set('timeDelay', 0);
    
    yTransitions.push([newTransition]);
  };

  return (
    <div style={{ padding: 20, display: 'flex', gap: 20 }}>
      <div style={{ flex: 1 }}>
        <h2>🏗️ Yjs TPN Data Builder</h2>
        <p>This component demonstrates the foundational Yjs data structure for the TPN.</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={addPlace}>Add Place</button>
          <button onClick={addTransition}>Add Transition</button>
        </div>
        <p>Click the buttons to add elements to the shared Yjs document. The state below reflects the live data model.</p>
      </div>
      <div style={{ flex: 1, background: '#f0f0f0', padding: 10, borderRadius: 4 }}>
        <h3>Live Y.Doc State:</h3>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <code>{petriNetState}</code>
        </pre>
      </div>
    </div>
  );
}
