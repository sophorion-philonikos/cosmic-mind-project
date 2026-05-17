'use client';
import { useState } from 'react';
import { Send, Bot } from 'lucide-react';

export default function ChatInterface({ setActiveNodes }: { setActiveNodes?: any }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'I am the Cosmic Mind. Ask me about the texts of Genesis.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });
      
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: 'assistant', content: "Error connecting to the offline brain." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-transparent p-4 flex flex-col">
      <div className="border-b border-zinc-800 pb-3 mb-3 flex items-center gap-2">
        <Bot className="text-purple-400" size={20} />
        <h2 className="text-white font-semibold tracking-wide">Query the Archive</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed shadow-md ${
              m.role === 'user' 
                ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-none' 
                : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700 rounded-bl-none'
            }`}>
              {m.role === 'assistant' && <Bot className="inline-block mr-2 mb-1 opacity-50" size={14}/>}
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-zinc-800/80 text-zinc-400 p-3 rounded-xl rounded-bl-none text-sm animate-pulse border border-zinc-700">
               Consulting the texts...
             </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
          placeholder="Ask about creation..."
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 text-purple-400 p-2 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}