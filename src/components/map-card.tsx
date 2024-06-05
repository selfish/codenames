import clsx from "clsx";
import React, { useEffect, useState, useMemo } from 'react';

enum Type {
    Black, Blue, Red, Blank, Random
}

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


function MapCard() {
    const [randomColor, setRandomColor] = useState(() => [Color.Red, Color.Blue][Math.floor(Math.random() * 2)]);
    const [cells, setCells] = useState(() => shuffle([
        Type.Black,
        ...Array(8).fill(Type.Blue),
        ...Array(8).fill(Type.Red),
        ...Array(7).fill(Type.Blank),
        Type.Random
    ]));

    const styleMap = useMemo(() => ({
        [Type.Black]: Color.Black,
        [Type.Blue]: Color.Blue,
        [Type.Red]: Color.Red,
        [Type.Blank]: Color.Blank,
        [Type.Random]: randomColor
    }), [randomColor]);

    const handleRandomize = () => {
        setRandomColor([Color.Red, Color.Blue][Math.floor(Math.random() * 2)]);
        setCells(shuffle([...cells]));
    };

    return (
        <div className="w-full h-screen py-12 flex items-center justify-center text-[#dc4347]">
            <div className="grid gap-5 w-full max-w-xl mx-auto p-5 items-center" style={{ height: 'calc(100vh - 24px)' }}>
                <h1 className="text-center text-4xl bold" style={{color: styleMap[Type.Random]}}>{styleMap[Type.Random] === Color.Red ? "Red" : "Blue"} Starts</h1>
                <div className="bg-slate-900 p-5 rounded-xl border-2 border-slate-700 relative" style={{ aspectRatio: '1' }}>
                    <div className="absolute h-3 w-1/3 top-5 left-1/2 transform -translate-x-1/2 -translate-y-[calc(50%-1px)] rounded-xl border-2 border-slate-700" style={{backgroundColor: styleMap[Type.Random]}}></div>
                    <div className="absolute h-3 w-1/3 bottom-5 left-1/2 transform -translate-x-1/2 translate-y-[calc(50%-1px)] rounded-xl border-2 border-slate-700" style={{backgroundColor: styleMap[Type.Random]}} />
                    <div className="absolute w-3 h-1/3 left-5 top-1/2 transform -translate-y-1/2 -translate-x-[calc(50%-1px)] rounded-xl border-2 border-slate-700" style={{backgroundColor: styleMap[Type.Random]}}/>
                    <div className="absolute w-3 h-1/3 right-5 top-1/2 transform -translate-y-1/2 translate-x-[calc(50%-1px)] rounded-xl border-2 border-slate-700"  style={{backgroundColor: styleMap[Type.Random]}} />
                    <div
                        className="grid grid-cols-5 gap-2 bg-slate-900 p-5 rounded-xl border-2 border-slate-700 w-full">
                        {cells.map((cell, i) => (
                            <div className="aspect-square rounded-xl w-full border border-slate-500"
                                 style={{backgroundColor: styleMap[cell], aspectRatio: '1 / 1'}}
                                  key={i}></div>
                        ))}
                    </div>
                </div>

                <button role="button" className="text-center text-2xl bold bg-slate-600 text-white p-3 rounded-xl"
                        onClick={handleRandomize}>
                    Randomize
                </button>
            </div>
        </div>
    );




}

export default MapCard;
