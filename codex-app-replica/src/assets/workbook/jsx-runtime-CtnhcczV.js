import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";

const reactNamespace = {
  __esModule: true,
  default: React,
  ...React,
};

const jsxRuntimeNamespace = {
  __esModule: true,
  default: jsxRuntime,
  ...jsxRuntime,
};

function n() {
  return reactNamespace;
}

function t() {
  return jsxRuntimeNamespace;
}

export { n, t };
