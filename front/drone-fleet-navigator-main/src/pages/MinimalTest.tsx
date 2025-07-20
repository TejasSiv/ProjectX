// Absolute minimal test - no external dependencies
export default function MinimalTest() {
  return (
    <div>
      <h1>Minimal Test Page</h1>
      <p>If you can see this, React routing works.</p>
      <p>Current time: {new Date().toString()}</p>
      
      <div style={{
        padding: '20px',
        margin: '20px 0',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc'
      }}>
        <h2>Environment Check:</h2>
        <p>Node ENV: {process.env.NODE_ENV}</p>
        <p>Vite Mode: {import.meta.env.MODE}</p>
        <p>Base URL: {import.meta.env.BASE_URL}</p>
      </div>
      
      <button onClick={() => {
        console.log('Button clicked - JavaScript is working');
        alert('JavaScript is working!');
      }}>
        Test JavaScript
      </button>
    </div>
  );
}