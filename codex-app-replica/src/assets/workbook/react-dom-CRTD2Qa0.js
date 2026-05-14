import * as ReactDOM from "react-dom";

const reactDomNamespace = {
  __esModule: true,
  default: ReactDOM,
  ...ReactDOM,
};

function t() {
  return reactDomNamespace;
}

export { t };
