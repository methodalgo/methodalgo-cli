import Conf from "conf";

const schema = {
    apiKey: {
        type: "string",
        default: ""
    },
    apiBase: {
        type: "string",
        default: "https://mm.methodalgo.com"
    },
    lang: {
        type: "string",
        default: "en"
    }
};

const config = new Conf({
    projectName: "methodalgo",
    schema
});

export default config;
