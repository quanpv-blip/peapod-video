import { Solid } from 'remotion';
import React from 'react';

export const NewComposition: React.FC = () => {
	return (
		<>
			<Solid
				width={1080}
				height={1920}
				color="gray"
				style={{ position: 'absolute' }}
			/>
		</>
	);
};
