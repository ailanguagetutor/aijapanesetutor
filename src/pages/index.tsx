import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

interface Message {
  content: string;
  isUser: boolean;
  translatedContent?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUsingGemini, setIsUsingGemini] = useState<boolean>(false);

  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [llmSession, setLlmSession] = useState<any>(null);
  const [translator, setTranslator] = useState<any>(null);
  const [ja2EnTranslator, setJA2ENTranslator] = useState<any>(null)
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const initJA2ENTranslator = async () => {
      if (typeof translation !== 'undefined') {
        const languagePair = {
          sourceLanguage: 'ja',
          targetLanguage: 'en',
        };

        const canTranslate = await translation.canTranslate(languagePair);
        let translator;
        if (canTranslate !== 'no') {
          if (canTranslate === 'readily') {
            translator = await translation.createTranslator(languagePair);
          }
        }
        setJA2ENTranslator(translator);
      } else {
        // Fallback to Gemini API endpoint for translation
        setJA2ENTranslator({
          translate: async (text: string) => {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `Translate the following Japanese text to English:\n\n${text}`,
                conversationHistory: ''
              })
            });
            const data = await response.json();
            return data.response;
          }
        });
      }
    };

    initJA2ENTranslator();
  }, []);

  useEffect(() => {
    const initializeLlmSession = async () => {
      if (typeof ai !== 'undefined') {
        try {
          const session = await ai.languageModel.create({
            systemPrompt: "Act as a Japanese language tutor and have a conversation with a student, in Japanese language."
          });
          setLlmSession(session);
          setIsUsingGemini(false);
        } catch (error) {
          console.log("Primary LLM unavailable, falling back to Gemini");
          setIsUsingGemini(true);
        }
      } else {
        console.log("AI is undefined, using Gemini");
        setIsUsingGemini(true);
      }
    };

    initializeLlmSession();
  }, []);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (content: string, isUser: boolean) => {
    setMessages(prevMessages => [...prevMessages, { content, isUser }]);
    setMessage(content);
    if (!isUser) {
      speakMessage(content);
    }
  };

  const speakMessage = (message: string) => {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  };

  const getBotResponse = async (message: string): Promise<string> => {
    const conversationHistory = messages
      .slice(-50)
      .map(msg => `${msg.isUser ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n");
    const defaultErrorReply = "申し訳ありません。エラーが発生しました。Please try reloading the page.";
    if (isUsingGemini) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            conversationHistory: conversationHistory
          }),
        });

        const data = await response.json();
        return data.response;
      } catch (error) {
        return defaultErrorReply;
      }
    } else {
      // Original LLM API call
      const result = await llmSession.prompt(`You are having a conversation in Japanese. Here's the conversation so far:

          ${conversationHistory}
          
          Reply in this structured format:
          
          Input: "Long time no see!"
          Output: { "reply": "How have you been?" }
          
          Now, construct a reply to the latest message:
          
          Input: "${message}"
          Output:`);

      const jsonMatch = result.match(/\{.*?\}/);
      let reply = "";

      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        const parsedJson = JSON.parse(jsonString);
        reply = parsedJson.reply;
      } else {
        reply = defaultErrorReply;
      }
      return reply;
    }
  };

  const handleSendMessage = (userInput: string) => {
    if (userInput.trim()) {
      addMessage(userInput, true);
      setInputValue('');

      setTimeout(async () => {
        const botResponse = await getBotResponse(userInput);
        addMessage(botResponse, false);
      }, 1000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();

      setIsRecording(true);
      setStatusMessage('Recording... Speak now.');

      if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'ja-JP';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.start();

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {

        };

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');

          setInputValue(transcript);

          if (event.results[0].isFinal) {
            stopRecording();
            handleSendMessage(transcript);
          }
        };
      } else {
        setStatusMessage('Speech recognition is not supported in this browser.');
      }
    } catch (error) {
      setStatusMessage('Error accessing the microphone. Please ensure you have given permission and are using a supported browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setStatusMessage('');
    }
  };

  const handleTranslateMessage = async (index: number) => {
    if (!ja2EnTranslator || !messages[index]) return;

    const translatedText = await ja2EnTranslator.translate(messages[index].content);

    setMessages(prevMessages => prevMessages.map((msg, i) =>
      i === index ? { ...msg, translatedContent: translatedText } : msg
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>AI Japanese Tutor: Your personal Japanese tutor and conversation practice partner</title>
        <meta name="description" content="AI Language Tutor: Japanese conversation practice with your AI language tutor" />
        <link rel="canonical" href="https://www.aijapanesetutor.org" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative py-3 sm:max-w-4xl sm:mx-auto w-full px-4 sm:px-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-4xl mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                    <a href="https://www.aijapanesetutor.org">AI Japanese Tutor</a>
                  </h1>
                  <p className="text-gray-600">Your personal Japanese tutor and conversation practice partner</p>
                </div>

                <div ref={chatMessagesRef}
                  className="h-[60vh] overflow-y-auto mb-4 p-4 border-2 border-indigo-100 rounded-xl bg-white shadow-inner">
                  {messages.map((message, index) => (
                    <div key={index} className={`mb-4 ${message.isUser ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block p-3 rounded-xl shadow-sm 
                        ${message.isUser
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800'}`}>
                        <div className="font-medium">{message.content}</div>
                        {message.translatedContent && (
                          <div className="text-sm mt-2 border-t border-gray-200 pt-2 
                            ${message.isUser ? 'text-blue-100' : 'text-gray-600'}">
                            {message.translatedContent}
                          </div>
                        )}
                        {!message.isUser && (
                          <div className="mt-2 border-t border-gray-200 pt-2">
                            <button
                              onClick={() => speakMessage(message.content)}
                              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors duration-200"
                              title="Listen"
                            >
                              🔊
                            </button>
                            <button
                              onClick={() => handleTranslateMessage(index)}
                              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors duration-200 ml-1"
                              title="Translate"
                            >
                              🌐
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                    className="flex-grow mr-2 p-2 border border-gray-300 rounded"
                    placeholder="Type your message here..."
                  />
                  <button onClick={() => handleSendMessage(inputValue)} className="p-2 bg-blue-500 text-white rounded">➤</button>
                  {isRecording ? (
                    <button onClick={stopRecording} className="ml-2 p-2 bg-red-500 text-white rounded">⏹</button>
                  ) : (
                    <button onClick={startRecording} className="ml-2 p-2 bg-green-500 text-white rounded">🎤</button>
                  )}
                </div>
                {statusMessage && <p className="text-red-500 text-center">{statusMessage}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}