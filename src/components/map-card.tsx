import clsx from "clsx";
import React, { useState, useMemo } from 'react';

enum Type {
    Black, Blue, Red, Blank, Random
}

const cellStructure = [
    Type.Black,
    ...Array(8).fill(Type.Blue),
    ...Array(8).fill(Type.Red),
    ...Array(7).fill(Type.Blank),
    Type.Random
];

enum Color {
    Black = "#111111",
    Red = "#dc4347",
    Blue = "#3c83b1",
    Blank = "#e6dfa7",
}

function shuffle(array: Type[]): Type[] {
    let currentIndex = array.length;

    while (currentIndex !== 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

const alternating = [
    Type.Blue, Type.Red, Type.Blue, Type.Red, Type.Blue,
    Type.Red, Type.Blue, Type.Red, Type.Blue, Type.Red,
    Type.Blue, Type.Red, Type.Blue, Type.Red, Type.Blue,
    Type.Red, Type.Blue, Type.Red, Type.Blue, Type.Red,
    Type.Blue, Type.Red, Type.Blue, Type.Red, Type.Blue
];


function MapCard() {
    const [randomColor, setRandomColor] = useState(() => [Color.Red, Color.Blue][Math.floor(Math.random() * 2)]);
    const [start, setStart] = useState(true);
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<Type[]>(alternating);

    const styleMap = useMemo(() => ({
        [Type.Black]: Color.Black,
        [Type.Blue]: Color.Blue,
        [Type.Red]: Color.Red,
        [Type.Blank]: Color.Blank,
        [Type.Random]: randomColor
    }), [randomColor]);

    const handleRandomize = async () => {
        if (loading && !start) return;
        setLoading(true);
        setStart(false);
        for (let i = 0; i < 6; i++) {
            setCells(shuffle([...cellStructure]));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        setRandomColor([Color.Red, Color.Blue][Math.floor(Math.random() * 2)]);
        setCells(shuffle([...cellStructure]));
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoading(false);
    };

    return (
        <div className="w-full h-screen py-12 flex items-center justify-center text-[#dc4347]">
            <div className="grid gap-5 w-full max-w-xl mx-auto p-5 items-center"
                 style={{ height: 'calc(100vh - 24px)' }}>
                <h1 className="text-center text-4xl bold transition duration-1000" style={{
                    color: styleMap[Type.Random],
                    opacity: loading ? 0 : 100
                }}>{styleMap[Type.Random] === Color.Red ? "Red" : "Blue"} Starts</h1>
                <div className="bg-slate-900 p-5 rounded-xl border-2 border-slate-700 relative"
                     style={{ aspectRatio: '1' }}>
                    <div className="absolute h-3 w-1/3 top-5 left-1/2 transform -translate-x-1/2 -translate-y-[calc(50%-1px)] rounded-xl border-2 border-slate-700 transition duration-1000" style={{ backgroundColor: loading ? Color.Black : styleMap[Type.Random] }}></div>
                    <div className="absolute h-3 w-1/3 bottom-5 left-1/2 transform -translate-x-1/2 translate-y-[calc(50%-1px)] rounded-xl border-2 border-slate-700 transition duration-1000" style={{ backgroundColor: loading ? Color.Black : styleMap[Type.Random] }}/>
                    <div className="absolute w-3 h-1/3 left-5 top-1/2 transform -translate-y-1/2 -translate-x-[calc(50%-1px)] rounded-xl border-2 border-slate-700 transition duration-1000" style={{ backgroundColor: loading ? Color.Black : styleMap[Type.Random] }}/>
                    <div className="absolute w-3 h-1/3 right-5 top-1/2 transform -translate-y-1/2 translate-x-[calc(50%-1px)] rounded-xl border-2 border-slate-700 transition duration-1000" style={{ backgroundColor: loading ? Color.Black : styleMap[Type.Random] }}/>
                    <div className="grid grid-cols-5 gap-2 bg-slate-900 p-5 rounded-xl border-2 border-slate-700 w-full">
                        {cells.map((cell, i) => (
                            <div
                                className="aspect-square rounded-xl w-full border border-slate-500 transition duration-500"
                                style={{ backgroundColor: styleMap[cell], aspectRatio: '1 / 1' }}
                                key={i}></div>
                        ))}
                    </div>
                </div>

                <button role="button"
                        className={clsx("text-center text-2xl bold bg-slate-600 text-white disabled:text-slate-500 p-3 rounded-xl animate-[wiggle_1s_ease-in-out_infinite] transition duration-1000", loading && "disabled")}
                        onClick={handleRandomize} disabled={loading && !start}>
                    Randomize
                </button>
            </div>
        </div>
    );


}

export default MapCard;
