import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { Fonts } from '@/constants/theme';

interface ScreenHeaderProps {
    title?: string;
    subtitle?: string;
    onBack: () => void;
    rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    rightText?: string;
    onRightPress?: () => void;
}

export function ScreenHeader({ title, subtitle, onBack, rightIcon, rightText, onRightPress }: ScreenHeaderProps) {
    return (
        <View className="flex-row items-center justify-between mb-8 px-6 pt-4">
            <Pressable
                onPress={onBack}
                className="w-10 h-10 items-center justify-center rounded-full bg-white shadow-sm"
            >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#1A1A1A" />
            </Pressable>

            <View className="items-center flex-1">
                {subtitle && (
                    <ThemedText className="text-[10px] font-black uppercase tracking-[2px] mb-1" style={{ color: '#FFAD91' }}>
                        {subtitle}
                    </ThemedText>
                )}
                {title && (
                    <ThemedText className="text-lg font-black" style={{ fontFamily: Fonts.title, color: '#1A1A1A' }}>
                        {title}
                    </ThemedText>
                )}
            </View>

            {rightIcon || rightText ? (
                <Pressable
                    onPress={onRightPress}
                    className={`h-10 items-center justify-center rounded-full bg-white/50 ${rightText ? 'px-4' : 'w-10'}`}
                >
                    {rightIcon ? (
                        <MaterialCommunityIcons name={rightIcon} size={24} color="#AAB7C6" />
                    ) : (
                        <ThemedText className="text-sm font-black" style={{ color: '#AAB7C6' }}>
                            {rightText}
                        </ThemedText>
                    )}
                </Pressable>
            ) : (
                <View style={{ width: 40 }} />
            )}
        </View>
    );
}
