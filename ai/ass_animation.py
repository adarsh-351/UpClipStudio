"""
Professional ASS Animation Engine
Version : 1.0
"""

class ASSAnimation:

    @staticmethod
    def none():

        return ""

    @staticmethod
    def pop():

        return r"{\fscx80\fscy80\t(0,150,\fscx100\fscy100)}"

    @staticmethod
    def zoom():

        return r"{\fscx120\fscy120\t(0,200,\fscx100\fscy100)}"

    @staticmethod
    def fade():

        return r"{\fad(250,250)}"

    @staticmethod
    def bounce():

        return r"{\move(960,1080,960,1020)}"

    @staticmethod
    def karaoke(duration=30):

        return rf"{{\k{duration}}}"