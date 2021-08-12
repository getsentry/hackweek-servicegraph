import React from "react";
import styled from "styled-components";

import { QueryClient, QueryClientProvider } from "react-query";
// import { ReactQueryDevtools } from "react-query/devtools";
import tw from "twin.macro";

import ErrorBoundary from "./ErrorBoundary";
import ServiceGraph from "./ServiceGraph";

const queryClient = new QueryClient();

function App() {
  const [hideModal, setHideModal] = React.useState<boolean>(false);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <main className="container mx-auto flex flex-col min-h-screen items-center">
          <ServiceGraph />
        </main>
        <ModalLandingPage
          style={{
            display: hideModal ? "none" : "flex",
          }}
        >
          <Content>
            <h1 className="text-5xl flex justify-center	">Service Gra.ph</h1>
            <hr className="my-4" />
            <div className="flex justify-center ">
              <ButtonLink
                onClick={(event) => {
                  event.preventDefault();
                  setHideModal(true);
                }}
              >
                Let me in!
              </ButtonLink>
            </div>
            <hr className="my-4" />
            <p className="p-2">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin
              pharetra scelerisque augue, non luctus nulla aliquet id. Curabitur
              augue eros, maximus nec ornare a, ultrices a ipsum. Nunc placerat
              dui sit amet enim molestie tempus quis ac enim. Aliquam erat
              volutpat. Quisque tristique purus magna. Mauris vel varius arcu,
              eu interdum quam. Interdum et malesuada fames ac ante ipsum primis
              in faucibus. Donec elementum tincidunt dui nec tempor. Mauris a
              pellentesque turpis. Etiam bibendum nisl vitae massa finibus
              placerat. Nulla eget aliquam mauris. Duis ultrices sollicitudin
              dolor aliquam sollicitudin. Mauris et ligula eget turpis interdum
              tempor. Fusce at euismod sapien, vitae accumsan diam. Integer
              vestibulum pulvinar erat eu rhoncus. Vestibulum et erat sem.
              Integer id magna eget nunc lobortis varius nec quis turpis.
              Quisque ut sem non ex fermentum hendrerit. Vivamus accumsan metus
              et lectus blandit, sit amet pharetra arcu imperdiet. Etiam commodo
              ligula eget tortor scelerisque tincidunt. In ullamcorper leo sit
              amet libero lobortis, sit amet porta magna laoreet. Donec
              consectetur ut ex convallis pretium. Quisque elementum urna orci,
              tempus sollicitudin dolor viverra in. Nunc dapibus ullamcorper
              posuere. Phasellus condimentum volutpat nunc et imperdiet. Morbi
              rutrum leo sit amet sem varius varius. Pellentesque vulputate
              rutrum maximus. Nunc vel massa ut turpis sollicitudin auctor.
              Aliquam condimentum eleifend nulla, vitae vehicula lacus.
              Curabitur id posuere nunc, ut faucibus orci. Vestibulum faucibus
              eu nunc nec hendrerit. Ut ut nulla turpis. Etiam blandit non eros
              sit amet eleifend. Nulla vitae nisi tempor, vestibulum justo eu,
              laoreet nisi. Nullam fermentum a orci ut laoreet. Sed quis odio ac
              sem iaculis tempus varius ut erat. Morbi efficitur nibh et urna
              venenatis, eu porttitor ipsum tincidunt. Fusce malesuada, velit in
              elementum sagittis, nisi quam cursus neque, at auctor erat turpis
              ut mi. Sed imperdiet posuere risus nec faucibus. Aliquam erat
              volutpat. Mauris mi eros, vehicula ac aliquet et, bibendum non ex.
              Mauris consequat lacus sit amet nisi sagittis interdum. Nulla
              sodales euismod neque ac tincidunt. Nulla facilisi. Etiam at
              vulputate risus, vel cursus leo. Mauris pretium risus nisl, vel
              tincidunt lectus pellentesque sit amet. Phasellus dignissim mollis
              sem vel finibus. Etiam ut lectus eget eros tincidunt eleifend nec
              eu lacus. Aliquam vitae condimentum quam. Pellentesque lobortis
              eros nec eros accumsan, ut ultrices dui mollis. Duis dictum mauris
              odio, eu tincidunt est egestas id.
            </p>
          </Content>
        </ModalLandingPage>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const ModalLandingPage = styled.div`
  ${tw`bg-white flex min-h-screen justify-center content-center p-4`};
  position: absolute;
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  top: 0;
  left: 0;
  z-index: 9999999;
`;

const Content = styled.div`
  ${tw`max-w-xl`};
`;

const ButtonLink = styled.a`
  ${tw`cursor-pointer	 whitespace-nowrap inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 animate-pulse animate-bounce`};
`;

export default App;
