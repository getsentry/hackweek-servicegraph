import React from "react";

import { QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import ServiceGraph from "./ServiceGraph";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="container mx-auto flex flex-col min-h-screen justify-center items-center">
        <ServiceGraph />
      </main>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}

export default App;
