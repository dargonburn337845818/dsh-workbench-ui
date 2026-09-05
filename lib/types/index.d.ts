import z from 'schemastery';
export declare const name = "@dsh-external/dsh-workbench-ui";
export declare const inject: string[];
export interface Config {
    title: string;
}
export declare const Config: z<Schemastery.ObjectS<{
    title: z<string, string>;
}>, Schemastery.ObjectT<{
    title: z<string, string>;
}>>;
export declare function apply(ctx: any, config: Config): void;
